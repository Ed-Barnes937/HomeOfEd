// Integration: prove Better Auth runs against the app's INJECTED DbClient
// (PGlite here, real Postgres in prod) using the merged schema's committed
// migrations — no Better Auth generate/migrate involved.
import { fileURLToPath } from 'node:url'

import { freshTestDb, type DbClient } from '@hoe/db'
import { loadMigrationsFromDir } from '@hoe/db/node'
import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'

import { sproutSchema, user as userTable, type SproutSchema } from '../schema.ts'
import { createSproutAuth, type SproutAuth } from './betterAuth.ts'
import { resolveParentUser } from './providers.ts'

let auth: SproutAuth
let db: DbClient<SproutSchema>

// Registration requires both claims (ADR-0014 / ADR-0015); the client-supplied
// timestamps are carried in the payload but IGNORED — the hook server-stamps.
const attested = {
  ukResidenceAttestedAt: new Date('2020-01-01T00:00:00Z'),
  tosAgreedAt: new Date('2020-01-01T00:00:00Z'),
}

beforeAll(async () => {
  const migrations = await loadMigrationsFromDir(
    fileURLToPath(new URL('../migrations', import.meta.url)),
  )
  db = await freshTestDb(sproutSchema, migrations)
  auth = createSproutAuth(db, { secret: 'integration-test-secret' })
})

describe('createSproutAuth over the injected client', () => {
  it('resolves no session for an anonymous request', async () => {
    const session = await auth.api.getSession({ headers: new Headers() })
    expect(session).toBeNull()
  })

  it('signs a parent up and resolves their cookie session to a parent user', async () => {
    const res = await auth.api.signUpEmail({
      body: {
        email: 'parent@example.com',
        password: 'correct-horse-battery',
        name: 'Parent',
        ...attested,
      },
      asResponse: true,
    })
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()

    const req = new Request('http://localhost/api/trpc/x', {
      headers: { cookie: setCookie ?? '' },
    })
    const user = await resolveParentUser(auth, req)
    expect(user?.role).toBe('parent')
    expect(typeof user?.id).toBe('string')
  })

  // ADR-0014 item 3 / ADR-0015 item 6: the before-create hook is the control,
  // not the form — it rejects unattested/unagreed signups and stamps both
  // columns with server time.
  it('rejects a signup without the UK residence attestation', async () => {
    const res = await auth.api.signUpEmail({
      body: {
        email: 'unattested@example.com',
        password: 'correct-horse-battery',
        name: 'Unattested',
        tosAgreedAt: attested.tosAgreedAt,
      },
      asResponse: true,
    })
    expect(res.status).toBe(400)
    const rows = await db.select().from(userTable).where(eq(userTable.email, 'unattested@example.com'))
    expect(rows).toHaveLength(0)
  })

  it('rejects a signup without ToS agreement', async () => {
    const res = await auth.api.signUpEmail({
      body: {
        email: 'unagreed@example.com',
        password: 'correct-horse-battery',
        name: 'Unagreed',
        ukResidenceAttestedAt: attested.ukResidenceAttestedAt,
      },
      asResponse: true,
    })
    expect(res.status).toBe(400)
    const rows = await db.select().from(userTable).where(eq(userTable.email, 'unagreed@example.com'))
    expect(rows).toHaveLength(0)
  })

  it('server-stamps both timestamps, ignoring the client-supplied values', async () => {
    const before = Date.now()
    const res = await auth.api.signUpEmail({
      body: {
        email: 'attested@example.com',
        password: 'correct-horse-battery',
        name: 'Attested',
        ...attested,
      },
      asResponse: true,
    })
    const after = Date.now()
    expect(res.status).toBe(200)

    const rows = await db.select().from(userTable).where(eq(userTable.email, 'attested@example.com'))
    const row = rows[0]
    if (!row) throw new Error('expected the signed-up user row')
    for (const stamp of [row.ukResidenceAttestedAt, row.tosAgreedAt]) {
      // Server time, not the 2020 client value.
      expect(stamp.getTime()).toBeGreaterThanOrEqual(before)
      expect(stamp.getTime()).toBeLessThanOrEqual(after)
    }
  })

  // ADR-0019 (family pilot): with an invite code configured, the sign-up
  // endpoint is the control — the form field is UX only. Unset (all the tests
  // above) means open registration, unchanged.
  describe('invite-code gate', () => {
    let gated: SproutAuth

    beforeAll(() => {
      gated = createSproutAuth(db, {
        secret: 'integration-test-secret',
        inviteCode: 'pilot-code',
      })
    })

    // Through the real HTTP handler (the prod path): the API-level before-hook
    // rejects over the wire; a server-side `api.signUpEmail` call would see the
    // middleware error as a throw instead of a Response.
    const signUpWith = (email: string, extra: Record<string, unknown> = {}) =>
      gated.handler(
        new Request('http://localhost:3004/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            password: 'correct-horse-battery',
            name: 'Gated',
            ...attested,
            ...extra,
          }),
        }),
      )

    const expectNoRow = async (email: string) => {
      const rows = await db.select().from(userTable).where(eq(userTable.email, email))
      expect(rows).toHaveLength(0)
    }

    it('rejects a signup carrying no invite code', async () => {
      const res = await signUpWith('no-code@example.com')
      expect(res.status).toBe(403)
      await expectNoRow('no-code@example.com')
    })

    it('rejects a signup carrying the wrong invite code', async () => {
      const res = await signUpWith('wrong-code@example.com', { inviteCode: 'guess' })
      expect(res.status).toBe(403)
      await expectNoRow('wrong-code@example.com')
    })

    it('accepts a signup carrying the matching invite code', async () => {
      const res = await signUpWith('coded@example.com', { inviteCode: 'pilot-code' })
      expect(res.status).toBe(200)
      const rows = await db.select().from(userTable).where(eq(userTable.email, 'coded@example.com'))
      expect(rows).toHaveLength(1)
    })

    it('applies no gate when the option is unset — same handler path, no code', async () => {
      const res = await auth.handler(
        new Request('http://localhost:3004/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'ungated@example.com',
            password: 'correct-horse-battery',
            name: 'Ungated',
            ...attested,
          }),
        }),
      )
      expect(res.status).toBe(200)
    })
  })

  it('rejects attempts to overwrite the stamps via update-user', async () => {
    const res = await auth.api.signUpEmail({
      body: {
        email: 'immutable@example.com',
        password: 'correct-horse-battery',
        name: 'Immutable',
        ...attested,
      },
      asResponse: true,
    })
    const cookie = res.headers.get('set-cookie') ?? ''

    const readStamps = async () => {
      const rows = await db
        .select()
        .from(userTable)
        .where(eq(userTable.email, 'immutable@example.com'))
      const row = rows[0]
      if (!row) throw new Error('expected the signed-up user row')
      return row
    }
    const original = await readStamps()

    // additionalFields are client-writable via update-user by default; the
    // update hook must reject any update touching the stamps.
    const updateRes = await auth.api.updateUser({
      body: {
        name: 'Renamed',
        ukResidenceAttestedAt: new Date('2030-01-01T00:00:00Z'),
        tosAgreedAt: new Date('2030-01-01T00:00:00Z'),
      },
      headers: new Headers({ cookie }),
      asResponse: true,
    })
    expect(updateRes.status).toBe(400)

    const afterRejected = await readStamps()
    expect(afterRejected.name).toBe('Immutable')
    expect(afterRejected.ukResidenceAttestedAt).toEqual(original.ukResidenceAttestedAt)
    expect(afterRejected.tosAgreedAt).toEqual(original.tosAgreedAt)

    // A legitimate update not touching the stamps still passes.
    await auth.api.updateUser({
      body: { name: 'Renamed' },
      headers: new Headers({ cookie }),
    })
    const afterRename = await readStamps()
    expect(afterRename.name).toBe('Renamed')
    expect(afterRename.ukResidenceAttestedAt).toEqual(original.ukResidenceAttestedAt)
    expect(afterRename.tosAgreedAt).toEqual(original.tosAgreedAt)
  })
})
