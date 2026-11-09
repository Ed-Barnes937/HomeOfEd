import { FamilyClientError } from '@hoe/accounts'

/**
 * What to put on the form. A typed refusal carries a message written for a
 * person - "that username is already taken" is the whole reason that mapping
 * exists - but a transport failure's message is a status code, so it does not
 * reach the screen.
 */
export function accountErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof FamilyClientError)) return fallback
  return error.code === 'INTERNAL_SERVER_ERROR' ? fallback : error.message
}
