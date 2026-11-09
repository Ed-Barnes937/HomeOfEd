import { freshTestDb, type DbClient } from '@hoe/db'
import { beforeEach, describe, expect, it } from 'vitest'

import { migrations } from '../migrations.ts'
import { familySchema, type FamilySchema } from '../schema.ts'

import { createFamilyAuth } from './betterAuth.ts'

const BASE_URL = 'http://localhost:3012'
const INVITE_CODE = 'dev-insecure-invite'

let db: DbClient<FamilySchema>
let auth: ReturnType<typeof createFamilyAuth>

beforeEach(async () => {
  db = await freshTestDb(familySchema, migrations)
  auth = createFamilyAuth(db, {
    baseURL: BASE_URL,
    secret: 'test-only-secret',
    inviteCode: INVITE_CODE,
    trustedOrigins: [BASE_URL],
  })
})

// Through the real HTTP handler, which is the production path: the API-level
// before-hook rejects over the wire, where a server-side api.signUpEmail call
// would see the middleware error as a throw instead of a Response.
function signUp(body: Record<string, unknown>): Promise<Response> {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify(body),
    }),
  )
}

function users(): Promise<(typeof familySchema.user.$inferSelect)[]> {
  return db.select().from(familySchema.user)
}

const credentials = { name: 'Ada', email: 'ada@example.com', password: 'correct-horse-battery' }

describe('the registration invite gate (ADR 0057)', () => {
  it('creates the parent when the invite code matches', async () => {
    const response = await signUp({ ...credentials, inviteCode: INVITE_CODE })

    expect(response.status).toBe(200)
    expect((await users()).map((row) => row.email)).toEqual(['ada@example.com'])
  })

  it('refuses a sign-up carrying no invite code, and creates no user', async () => {
    const response = await signUp(credentials)

    expect(response.status).toBe(403)
    expect(await users()).toEqual([])
  })

  it('refuses a sign-up carrying the wrong invite code, and creates no user', async () => {
    const response = await signUp({ ...credentials, inviteCode: 'guessed' })

    expect(response.status).toBe(403)
    expect(await users()).toEqual([])
  })

  it('signs a registered parent back in and resolves their session', async () => {
    await signUp({ ...credentials, inviteCode: INVITE_CODE })

    const signedIn = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE_URL },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      }),
    )
    expect(signedIn.status).toBe(200)

    const cookie = signedIn.headers.getSetCookie().join('; ')
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.email).toBe(credentials.email)
  })
})

/**
 * CORS cannot protect these routes: a CORS-simple POST is sent before the
 * allowlist is consulted, so Better Auth's own origin check is the control. It
 * is global over non-GET routes rather than per-route, and this pins that -
 * `disableCSRFCheck` or a `skipOriginCheck` entry would turn it red.
 */
describe('the Better Auth origin check', () => {
  const signedInCookie = async (): Promise<string> => {
    await signUp({ ...credentials, inviteCode: INVITE_CODE })
    const signedIn = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE_URL },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      }),
    )
    return signedIn.headers.getSetCookie().join('; ')
  }

  const post = (route: string, cookie: string, origin: string | null): Promise<Response> =>
    auth.handler(
      new Request(`${BASE_URL}/api/auth/${route}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          ...(origin === null ? {} : { origin }),
        },
        body: '{}',
      }),
    )

  const ROUTES = ['sign-out', 'update-user', 'change-password', 'delete-user', 'change-email']

  it.each(ROUTES)('refuses %s from an estate app origin, not only sign-in', async (route) => {
    const cookie = await signedInCookie()

    const response = await post(route, cookie, 'https://boop.homeofed.com')

    expect(response.status).toBe(403)
    expect(await response.text()).toContain('INVALID_ORIGIN')
  })

  it.each(ROUTES)('refuses %s with no origin header at all', async (route) => {
    const cookie = await signedInCookie()

    const response = await post(route, cookie, null)

    expect(response.status).toBe(403)
    expect(await response.text()).toContain('ORIGIN')
  })
})

/**
 * The gate is route-enumerated - it matches `ctx.path === '/sign-up/email'` - so
 * any option that adds a second route reaching `createUser` would bypass it in
 * silence. ADR 0057 rests entirely on this gate, so the option set is pinned
 * whole: adding one turns this red and forces the question to be asked.
 */
describe('the Better Auth options (ADR 0057)', () => {
  // Asserted over the key list, not by property access: `options` is typed as
  // the literal we passed, so naming an absent key would not even compile.
  it('declares no provider or plugin that could open another sign-up path', () => {
    expect(Object.keys(auth.options)).not.toContain('socialProviders')
    expect(Object.keys(auth.options)).not.toContain('plugins')
  })

  it('declares exactly the options the gate was reasoned about', () => {
    // `advanced` holds one key, `disableOriginCheck: false`, which states the
    // origin check rather than inheriting a default that flips under NODE_ENV.
    expect(Object.keys(auth.options.advanced ?? {})).toEqual(['disableOriginCheck'])
    expect(Object.keys(auth.options).sort()).toEqual([
      'advanced',
      'baseURL',
      'database',
      'emailAndPassword',
      'hooks',
      'secret',
      'trustedOrigins',
    ])
  })

  it('leaves email/password as the only credential route', () => {
    expect(auth.options.emailAndPassword).toEqual({ enabled: true })
  })
})
