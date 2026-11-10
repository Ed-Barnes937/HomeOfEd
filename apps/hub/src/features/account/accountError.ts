import { FamilyClientError } from '@hoe/accounts'

/**
 * Codes whose message is machine output rather than something written for a
 * person. tRPC answers a parser failure with the ZodError's own message, which
 * is a stringified issue array; the CSRF guard's 415 answers with a sentence
 * about content types written for whoever wrote the client; and a transport
 * failure's message is a status code.
 */
const UNREADABLE_CODES: ReadonlySet<string> = new Set([
  'BAD_REQUEST',
  'INTERNAL_SERVER_ERROR',
  'UNSUPPORTED_MEDIA_TYPE',
])

/**
 * What to put on the form. A typed refusal can carry a message written for a
 * person - "that username is already taken" is the whole reason that mapping
 * exists - but it can equally carry JSON, so neither the code nor the shape of
 * the message is trusted on its own.
 */
export function accountErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof FamilyClientError)) return fallback
  if (UNREADABLE_CODES.has(error.code)) return fallback
  return readsAsProse(error.message) ? error.message : fallback
}

/**
 * The list above can only name refusals somebody thought of, so it fails open;
 * this does not. A message that opens as JSON is machine output whatever code
 * carried it, and a parent is shown the house sentence instead.
 */
function readsAsProse(message: string): boolean {
  const trimmed = message.trim()
  return trimmed !== '' && !trimmed.startsWith('[') && !trimmed.startsWith('{')
}
