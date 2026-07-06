// Integration: prove Better Auth runs against the app's INJECTED DbClient
// (PGlite here, real Postgres in prod) using the merged schema's committed
// migrations — no Better Auth generate/migrate involved.
import { fileURLToPath } from 'node:url'

import { freshTestDb } from '@hoe/db'
import { loadMigrationsFromDir } from '@hoe/db/node'
import { beforeAll, describe, expect, it } from 'vitest'

import { sproutSchema } from '../schema.ts'
import { createSproutAuth, type SproutAuth } from './betterAuth.ts'
import { resolveParentUser } from './providers.ts'

let auth: SproutAuth

beforeAll(async () => {
  const migrations = await loadMigrationsFromDir(
    fileURLToPath(new URL('../migrations', import.meta.url)),
  )
  const db = await freshTestDb(sproutSchema, migrations)
  auth = createSproutAuth(db, { secret: 'integration-test-secret' })
})

describe('createSproutAuth over the injected client', () => {
  it('resolves no session for an anonymous request', async () => {
    const session = await auth.api.getSession({ headers: new Headers() })
    expect(session).toBeNull()
  })

  it('signs a parent up and resolves their cookie session to a parent user', async () => {
    const res = await auth.api.signUpEmail({
      body: { email: 'parent@example.com', password: 'correct-horse-battery', name: 'Parent' },
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
})
