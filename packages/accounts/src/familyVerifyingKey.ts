import { assertFitForDeployment, isDeployed, type Environment } from '@hoe/deploy-guard'

/** The family service's public key, from `openssl pkey -in <private-key.pem> -pubout`. */
export const PRODUCTION_FAMILY_PUBLIC_KEY: string | null = null

/**
 * On Fly the committed production key is the only key, and `FAMILY_TOKEN_PUBLIC_KEY`
 * refuses the boot; off Fly that variable wins (ADR 0070). Internal: apps call
 * `familyDocumentGateFromEnv`.
 */
export function familyVerifyingKey(env: Environment, productionKey: string | null): string {
  if (isDeployed(env)) {
    assertFitForDeployment(env, {}, ['FAMILY_TOKEN_PUBLIC_KEY'])
    if (!productionKey) {
      throw new Error(
        'PRODUCTION_FAMILY_PUBLIC_KEY is not committed in @hoe/accounts, and on deployed ' +
          'infrastructure (FLY_APP_NAME is set) it is the only family verifying key. Commit it ' +
          'before setting FAMILY_ACCOUNT_URL.',
      )
    }
    return productionKey
  }
  const pem = env.FAMILY_TOKEN_PUBLIC_KEY?.replace(/\\n/g, '\n') || productionKey
  if (!pem) {
    throw new Error(
      'There is no family verifying key: set FAMILY_TOKEN_PUBLIC_KEY, or commit ' +
        'PRODUCTION_FAMILY_PUBLIC_KEY in @hoe/accounts. The gate cannot run without one.',
    )
  }
  return pem
}
