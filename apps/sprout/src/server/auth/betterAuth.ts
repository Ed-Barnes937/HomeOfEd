// Better Auth instance for sprout (plan §5.2 / D5). Ported from the source
// `apps/web/src/lib/auth.ts` with two deliberate changes:
//
//  1. The Drizzle adapter points at the app's SINGLE injected `DbClient` — the
//     same client `DrizzleSproutStore` uses — not a separately-constructed
//     `postgres()`/`getDb()`. Store and auth share one connection (plan §6.3).
//  2. Better Auth's own generate/migrate mechanism is NOT used. Its 4 tables
//     (`user`/`session`/`account`/`verification`) live in the app's committed
//     `migrations/` and are applied by `migratePostgres` like every other table
//     (plan D2) — so there is nothing here that mutates the schema at runtime.
import type { DbClient } from '@hoe/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { account, session, user, verification, type SproutSchema } from '../schema.ts'

export interface CreateSproutAuthOpts {
  baseURL?: string
  secret?: string
}

/**
 * Build the Better Auth instance over the injected client. `db` is the app's
 * one `DbClient` (real Postgres in prod, PGlite in tests) — the adapter runs
 * its queries through it regardless of driver.
 */
export function createSproutAuth(db: DbClient<SproutSchema>, opts: CreateSproutAuthOpts = {}) {
  return betterAuth({
    baseURL: opts.baseURL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3004',
    secret: opts.secret ?? process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        subscriptionStatus: {
          type: 'string',
          defaultValue: 'trial',
          required: false,
        },
      },
    },
  })
}

export type SproutAuth = ReturnType<typeof createSproutAuth>
