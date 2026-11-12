// Typed environment for the identity layer, alongside `@hoe/db`'s loadDbEnv.
// Node-only: main.ts parses it ONCE at boot, so a missing secret crashes the
// process instead of failing the first sign-in. Nothing here is ever logged.
import { TEST_FAMILY_PRIVATE_KEY } from '@hoe/accounts/testing'
import { assertFitForDeployment, isDeployed, type Environment } from '@hoe/deploy-guard'
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
  /**
   * `on` admits the docker stack's localhost origins (cors.ts). compose.yml is
   * the only place that sets it, and it is refused on Fly.
   */
  DOCKER_STACK_ORIGINS: z.literal('on').optional(),
})

export type FamilyEnv = z.output<typeof familyEnvSchema>

/** The invite code is typed by hand; Better Auth itself wants 32 for its secret. */
const MIN_DEPLOYED_LENGTH = {
  REGISTRATION_INVITE_CODE: 16,
  BETTER_AUTH_SECRET: 32,
} as const

const LOCAL_ONLY = ['DOCKER_STACK_ORIGINS'] as const

/** PEMs differ by line wrapping and trailing newlines; the key material does not. */
function isCommittedTestKey(pem: string): boolean {
  const bare = (value: string): string => value.replace(/\s+/g, '')
  return bare(pem) === bare(TEST_FAMILY_PRIVATE_KEY)
}

/** The committed fixture key is public, so it may sign nothing on Fly (ADR 0078). */
function assertKeyFitForDeployment(pem: string, source: Environment): void {
  if (isDeployed(source) && isCommittedTestKey(pem)) {
    throw new Error(
      'FAMILY_TOKEN_PRIVATE_KEY is the committed @hoe/accounts/testing key, which is public ' +
        'knowledge, and FLY_APP_NAME says this is deployed infrastructure. Set the real Fly secret.',
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

  assertKeyFitForDeployment(parsed.data.FAMILY_TOKEN_PRIVATE_KEY, source)
  assertFitForDeployment(source, MIN_DEPLOYED_LENGTH, LOCAL_ONLY)

  return parsed.data
}
