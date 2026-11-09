// Typed environment for the identity layer, alongside `@hoe/db`'s loadDbEnv.
// Node-only: main.ts parses it ONCE at boot, so a missing secret crashes the
// process instead of failing the first sign-in. Nothing here is ever logged.
import { TEST_FAMILY_PRIVATE_KEY } from '@hoe/accounts/testing'
import { z } from 'zod'

export const familyEnvSchema = z.object({
  /**
   * The Ed25519 private key that signs family session tokens - a Fly secret
   * and the only key in the estate that can mint. Fly and `.env` both carry a
   * PEM on one line, so its newlines arrive escaped.
   */
  FAMILY_TOKEN_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((pem) => pem.replace(/\\n/g, '\n')),
  /** ADR 0057's legal gate: registration is closed to holders of this code. */
  REGISTRATION_INVITE_CODE: z.string().min(1),
  /** Better Auth's own cookie-signing secret. */
  BETTER_AUTH_SECRET: z.string().min(1),
  /** This service's public origin; Better Auth derives its cookie rules from it. */
  BETTER_AUTH_URL: z.url(),
})

export type FamilyEnv = z.output<typeof familyEnvSchema>

/** Published by being committed; `env.test.ts` re-reads the files to catch drift. */
export const COMMITTED_DEV_SECRETS: readonly string[] = [
  'dev-insecure-invite',
  'dev-insecure-secret',
  'dev-invite-code',
  'dev-better-auth-secret',
]

/** The invite code is typed by hand; Better Auth itself wants 32 for its secret. */
const MIN_DEPLOYED_LENGTH = {
  REGISTRATION_INVITE_CODE: 16,
  BETTER_AUTH_SECRET: 32,
} as const

/** PEMs differ by line wrapping and trailing newlines; the key material does not. */
function isCommittedTestKey(pem: string): boolean {
  const bare = (value: string): string => value.replace(/\s+/g, '')
  return bare(pem) === bare(TEST_FAMILY_PRIVATE_KEY)
}

/** Nothing this repo publishes may run on Fly (ADR 0078). */
function assertFitForDeployment(env: FamilyEnv, nodeEnv: string | undefined): void {
  if (isCommittedTestKey(env.FAMILY_TOKEN_PRIVATE_KEY)) {
    throw new Error(
      'FAMILY_TOKEN_PRIVATE_KEY is the committed @hoe/accounts/testing key, which is public ' +
        'knowledge, and FLY_APP_NAME says this is deployed infrastructure. Set the real Fly secret.',
    )
  }

  for (const name of ['REGISTRATION_INVITE_CODE', 'BETTER_AUTH_SECRET'] as const) {
    if (COMMITTED_DEV_SECRETS.includes(env[name])) {
      throw new Error(
        `${name} is a value committed to this repo, so anyone who can read it holds it. ` +
          'FLY_APP_NAME says this is deployed infrastructure; set the real Fly secret.',
      )
    }
    if (env[name].length < MIN_DEPLOYED_LENGTH[name]) {
      throw new Error(
        `${name} must be at least ${MIN_DEPLOYED_LENGTH[name]} characters on deployed ` +
          'infrastructure. Generate one with: openssl rand -base64 32',
      )
    }
  }

  // CORS's dev origins and tRPC's stack traces both key off NODE_ENV.
  if (nodeEnv !== 'production') {
    throw new Error(
      'NODE_ENV must be "production" on deployed infrastructure (FLY_APP_NAME is set): ' +
        'anything else widens the CORS allowlist and puts stack traces in error responses.',
    )
  }
}

/** Names only the variables at fault: three of them are secrets, never loggable. */
export function loadFamilyEnv(source: Record<string, string | undefined> = process.env): FamilyEnv {
  const parsed = familyEnvSchema.safeParse(source)
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))]
    throw new Error(`Invalid family identity environment: ${names.join(', ')} missing or invalid`)
  }

  if (source.FLY_APP_NAME) assertFitForDeployment(parsed.data, source.NODE_ENV)

  return parsed.data
}
