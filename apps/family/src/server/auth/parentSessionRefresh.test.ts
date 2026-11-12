// Over a real socket with the real Better Auth: the refreshed cookie is a reply
// header, which only the real pipeline shows surviving tRPC's own reply.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConsoleLogger, createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer, type FastifyInstance } from '@hoe/backend-kit/server'
import { freshTestDb, type DbClient } from '@hoe/db'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { migrations } from '../migrations.ts'
import { createAppRouter } from '../router.ts'
import { familySchema, type FamilySchema } from '../schema.ts'
import { DrizzleFamilyStore } from '../store.ts'

import { createFamilyAuth, type FamilyAuth } from './betterAuth.ts'
import { parentSessionSeam, registerParentSessionBridge } from './parentSessionBridge.ts'

const AUTH_URL = 'http://localhost:3012'
const DAY_MS = 24 * 60 * 60 * 1000
const NINETY_DAYS_MS = 90 * DAY_MS

let app: FastifyInstance
let auth: FamilyAuth
let db: DbClient<FamilySchema>
let base: string

beforeEach(async () => {
  db = await freshTestDb(familySchema, migrations)
  auth = createFamilyAuth(db, {
    baseURL: AUTH_URL,
    secret: 'test-only-secret',
    inviteCode: 'invite',
    trustedOrigins: [AUTH_URL],
  })

  app = await buildAppServer({
    router: createAppRouter({
      mintToken: () => {
        throw new Error('not used')
      },
    }),
    createContext: createContext({
      store: new DrizzleFamilyStore(db),
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger(),
      auth: parentSessionSeam,
    }),
    staticDir: await mkdtemp(join(tmpdir(), 'family-session-refresh-')),
    logger: new ConsoleLogger(),
    healthCheck: () => Promise.resolve({ ok: true }),
    registerRoutes: (instance) => registerParentSessionBridge(instance, auth),
  })

  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address()
  if (address === null || typeof address === 'string') throw new Error('no port bound')
  base = `http://127.0.0.1:${address.port}`
})

afterEach(async () => {
  await app.close()
})

/** Registers a parent and returns the `name=value` cookie the browser would keep. */
async function signedInCookie(): Promise<string> {
  const response = await auth.handler(
    new Request(`${AUTH_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: AUTH_URL },
      body: JSON.stringify({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'correct-horse-battery',
        inviteCode: 'invite',
      }),
    }),
  )
  expect(response.status).toBe(200)
  return sessionCookieOf(response.headers.getSetCookie())
}

function sessionCookieOf(setCookies: string[]): string {
  const found = setCookies.find((cookie) => cookie.startsWith('better-auth.session_token='))
  if (found === undefined) throw new Error('no session cookie')
  return found.split(';')[0] ?? ''
}

/** Moves the session's last refresh `days` into the past, as time passing would. */
async function ageSession(days: number): Promise<void> {
  await db.execute(
    sql`update session set expires_at = expires_at - make_interval(days => ${days}),
        updated_at = updated_at - make_interval(days => ${days})`,
  )
}

async function sessionExpiry(): Promise<number> {
  const [row] = await db.select().from(familySchema.session)
  if (row === undefined) throw new Error('no session row')
  return row.expiresAt.getTime()
}

async function me(cookie: string): Promise<{ setCookies: string[]; parent: unknown }> {
  const response = await fetch(`${base}/api/trpc/identity.me`, { headers: { cookie } })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { result: { data: { parent: unknown } } }
  return { setCookies: response.headers.getSetCookie(), parent: body.result.data.parent }
}

describe('the parent session slides on tRPC replies', () => {
  it('sends a fresh 90-day cookie once the session is over a day old', async () => {
    const cookie = await signedInCookie()
    await ageSession(2)

    const reply = await me(cookie)

    expect(reply.parent).toMatchObject({ email: 'ada@example.com' })
    expect(reply.setCookies).toHaveLength(1)
    expect(reply.setCookies[0]).toMatch(/^better-auth\.session_token=.+; Max-Age=7776000;/)
    expect(await sessionExpiry()).toBeGreaterThan(Date.now() + NINETY_DAYS_MS - DAY_MS)
    await expect(me(sessionCookieOf(reply.setCookies))).resolves.toMatchObject({
      parent: { email: 'ada@example.com' },
    })
  })

  it('rewrites neither the cookie nor the row within a day of the last refresh', async () => {
    const cookie = await signedInCookie()
    const expiry = await sessionExpiry()

    const reply = await me(cookie)

    expect(reply.parent).toMatchObject({ email: 'ada@example.com' })
    expect(reply.setCookies).toEqual([])
    expect(await sessionExpiry()).toBe(expiry)
  })

  it('clears the cookie of a session that no longer exists', async () => {
    const cookie = await signedInCookie()
    await db.delete(familySchema.session)

    const reply = await me(cookie)

    expect(reply.parent).toBeNull()
    expect(reply.setCookies).toContainEqual(
      expect.stringMatching(/^better-auth\.session_token=; Max-Age=0;/),
    )
  })

  it('sends no cookie to a request that carries none', async () => {
    const reply = await me('')

    expect(reply.parent).toBeNull()
    expect(reply.setCookies).toEqual([])
  })
})
