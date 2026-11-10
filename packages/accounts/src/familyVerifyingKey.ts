import { createPublicKey } from 'node:crypto'

import { isDeployed, type Environment } from '@hoe/deploy-guard'

import { TEST_FAMILY_PUBLIC_KEY } from './testing/testKeys.ts'

/** The family service's public key, from `openssl pkey -in <private-key.pem> -pubout`. */
export const PRODUCTION_FAMILY_PUBLIC_KEY: string | null = null

/**
 * The PEM `familyDocumentGate` verifies with: `FAMILY_TOKEN_PUBLIC_KEY` when set,
 * else the production key. On Fly the committed test key is refused (ADR 0070).
 */
export function familyVerifyingKey(
  env: Environment,
  productionKey: string | null = PRODUCTION_FAMILY_PUBLIC_KEY,
): string {
  const pem = env.FAMILY_TOKEN_PUBLIC_KEY?.replace(/\\n/g, '\n') || productionKey
  if (!pem) {
    throw new Error(
      'There is no family verifying key: set FAMILY_TOKEN_PUBLIC_KEY, or commit ' +
        'PRODUCTION_FAMILY_PUBLIC_KEY in @hoe/accounts. The gate cannot run without one.',
    )
  }
  if (isDeployed(env) && isTestKey(pem)) {
    throw new Error(
      'FAMILY_TOKEN_PUBLIC_KEY is the committed @hoe/accounts/testing key, whose private half ' +
        'is public knowledge, and FLY_APP_NAME says this is deployed infrastructure. Anyone ' +
        'could mint a token this gate accepts. Remove it so the production key applies.',
    )
  }
  return pem
}

function isTestKey(pem: string): boolean {
  const spki = (value: string) => createPublicKey(value).export({ type: 'spki', format: 'der' })
  try {
    return spki(pem).equals(spki(TEST_FAMILY_PUBLIC_KEY))
  } catch {
    return false // unparseable: familyDocumentGate refuses it by name
  }
}
