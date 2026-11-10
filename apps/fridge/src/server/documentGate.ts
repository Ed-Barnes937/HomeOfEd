import { familyDocumentGateFromEnv } from '@hoe/accounts/server'

/** fridge's gate (ADR 0093): on when `FAMILY_ACCOUNT_URL` is set, with `/b/<id>` share links left public. */
export function fridgeDocumentGate(env: Record<string, string | undefined>) {
  return familyDocumentGateFromEnv(env, { publicPaths: ['/b'] })
}
