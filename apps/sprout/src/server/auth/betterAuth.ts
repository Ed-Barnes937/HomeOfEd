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
import { APIError } from 'better-auth/api'

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
        // ADR-0014 / ADR-0015: the signup payload carries both claims; the
        // before-create hook below is the control (the form is UX only).
        ukResidenceAttestedAt: {
          type: 'date',
          required: false,
        },
        tosAgreedAt: {
          type: 'date',
          required: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Reject any signup lacking a true residence attestation or ToS
          // agreement, and stamp both columns with SERVER time — whatever
          // timestamp the client sent is ignored (ADR-0014 item 3 /
          // ADR-0015 item 6).
          before: (pending) => {
            const claims = pending as typeof pending & {
              ukResidenceAttestedAt?: unknown
              tosAgreedAt?: unknown
            }
            if (!claims.ukResidenceAttestedAt) {
              throw new APIError('BAD_REQUEST', {
                message: 'You must confirm you live in the United Kingdom.',
              })
            }
            if (!claims.tosAgreedAt) {
              throw new APIError('BAD_REQUEST', {
                message:
                  'You must agree to the Terms of Service and confirm you have read the Privacy Policy.',
              })
            }
            const now = new Date()
            return Promise.resolve({
              data: { ...pending, ukResidenceAttestedAt: now, tosAgreedAt: now },
            })
          },
        },
        update: {
          // The stamps are immutable once set. additionalFields are
          // client-writable through update-user by default, and a before-hook
          // can only merge over the payload (never strip from it), so any
          // update touching them is rejected outright.
          before: (data) => {
            const touched = data as { ukResidenceAttestedAt?: unknown; tosAgreedAt?: unknown }
            if (touched.ukResidenceAttestedAt !== undefined || touched.tosAgreedAt !== undefined) {
              throw new APIError('BAD_REQUEST', {
                message: 'The registration attestations cannot be changed.',
              })
            }
            return Promise.resolve({ data })
          },
        },
      },
    },
  })
}

export type SproutAuth = ReturnType<typeof createSproutAuth>
