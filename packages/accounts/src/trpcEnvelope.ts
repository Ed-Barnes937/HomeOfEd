// tRPC's HTTP envelope, unwrapped by hand because `AppRouter` lives in
// apps/family and no app may import it.
import { FamilyClientError } from './familyClientError.ts'

export async function unwrapTrpcResponse(res: Response): Promise<unknown> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  /**
   * A batched reply is an ARRAY of envelopes, so it carries neither `error` nor
   * `result` and would otherwise fall through to a mystery 500. Neither client
   * here batches - no `?batch=1`, one procedure per request - so this refuses
   * explicitly rather than guessing which envelope was meant.
   */
  if (Array.isArray(body)) {
    throw new FamilyClientError(
      'the family service answered with a batched reply, which this client does not read',
      'INTERNAL_SERVER_ERROR',
    )
  }

  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = body.error
    const { message, data } =
      typeof error === 'object' && error !== null
        ? (error as { message?: unknown; data?: { code?: unknown } })
        : {}
    throw new FamilyClientError(
      typeof message === 'string' ? message : `family service request failed (${res.status})`,
      typeof data?.code === 'string' ? data.code : 'INTERNAL_SERVER_ERROR',
    )
  }

  if (!res.ok || typeof body !== 'object' || body === null || !('result' in body)) {
    throw new FamilyClientError(
      `family service request failed (${res.status})`,
      'INTERNAL_SERVER_ERROR',
    )
  }

  return (body as { result: { data?: unknown } }).result.data
}
