// Typed environment for the identity layer, alongside `@hoe/db`'s loadDbEnv.
// Node-only: main.ts parses it ONCE at boot, so a missing secret crashes the
// process instead of failing the first sign-in. Nothing here is ever logged.
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
  return parsed.data
}
