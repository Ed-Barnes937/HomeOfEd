import { freshTestDb, type DbClient } from '@hoe/db'
import { beforeEach, describe, expect, it } from 'vitest'

import { migrations } from '../migrations.ts'
import { familySchema, type FamilySchema } from '../schema.ts'

import { createFamilyAuth } from './betterAuth.ts'

const BASE_URL = 'http://localhost:3010'
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
