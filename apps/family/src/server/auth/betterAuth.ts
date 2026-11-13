// Better Auth over the app's one injected DbClient. Its own migrator is never
// used: the four stock tables are declared in schema.ts and travel in family's
// committed migration journal (sprout precedent).
import type { DbClient } from '@hoe/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'

import { account, session, user, verification, type FamilySchema } from '../schema.ts'

const DAY_S = 24 * 60 * 60

/**
 * How long a parent stays signed in on a device after last using it, and how
 * often use pushes that out again, in seconds (ADR 0070, 2026-11-12 amendment).
 */
export const PARENT_SESSION_LIFETIME = { expiresIn: 90 * DAY_S, updateAge: DAY_S } as const

export interface CreateFamilyAuthOpts {
  /** This service's public origin; Better Auth derives its cookie rules from it. */
  baseURL: string
  secret: string
  /** ADR 0057's legal gate. Required: the gate can never be accidentally off. */
  inviteCode: string
  /** Cross-origin callers Better Auth accepts - the same CORS allowlist. */
  trustedOrigins: readonly string[]
}

export function createFamilyAuth(db: DbClient<FamilySchema>, opts: CreateFamilyAuthOpts) {
  const { inviteCode } = opts
  return betterAuth({
    // The gate runs at the API layer rather than on the user record, so the
    // code is read from the raw sign-up body and never touches a row.
    hooks: {
      before: createAuthMiddleware((ctx) => {
        if (ctx.path === '/sign-up/email') {
          const supplied = (ctx.body as { inviteCode?: unknown } | undefined)?.inviteCode
          if (supplied !== inviteCode) {
            throw new APIError('FORBIDDEN', {
              message: 'A valid invite code is required to register.',
            })
          }
        }
        return Promise.resolve()
      }),
    },
    baseURL: opts.baseURL,
    secret: opts.secret,
    trustedOrigins: [...opts.trustedOrigins],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: true },
    session: { ...PARENT_SESSION_LIFETIME },
    // Stated rather than inherited: Better Auth turns its origin check OFF by
    // default under NODE_ENV=test, so the one control in front of these routes
    // would be invisible to every test that tried to pin it.
    advanced: { disableOriginCheck: false },
  })
}

export type FamilyAuth = ReturnType<typeof createFamilyAuth>
