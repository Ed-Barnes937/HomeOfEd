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
