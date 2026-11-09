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

/** PEMs differ by line wrapping and trailing newlines; the key material does not. */
function isCommittedTestKey(pem: string): boolean {
  const bare = (value: string): string => value.replace(/\s+/g, '')
  return bare(pem) === bare(TEST_FAMILY_PRIVATE_KEY)
}

/**
 * Validate the identity environment, naming only the variables at fault: a
 * zod-prettified report would quote the offending values, and two of these are
 * secrets that must never reach a log.
 */
export function loadFamilyEnv(source: Record<string, string | undefined> = process.env): FamilyEnv {
  const parsed = familyEnvSchema.safeParse(source)
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))]
    throw new Error(`Invalid family identity environment: ${names.join(', ')} missing or invalid`)
  }

  // Defence in depth over the fixture hardcoded in compose.yml, following
  // sprout's GEO_ENFORCEMENT guard: anyone at all holds that key, so signing
  // with it on Fly would let the world mint tokens for the whole estate.
  if (source.FLY_APP_NAME && isCommittedTestKey(parsed.data.FAMILY_TOKEN_PRIVATE_KEY)) {
    throw new Error(
      'FAMILY_TOKEN_PRIVATE_KEY is the committed @hoe/accounts/testing key, which is public ' +
        'knowledge, and FLY_APP_NAME says this is deployed infrastructure. Set the real Fly secret.',
    )
  }

  return parsed.data
}
