// Signed child-session token (plan §5.2, resolves review issue #34).
//
// The source stored the child session as an UNSIGNED JSON blob in localStorage
// (`child-safe-llm-child-session`) — anyone could forge a child identity by
// editing localStorage. This replaces it with a tamper-evident token:
//
//   base64url(JSON claims) "." base64url(HMAC-SHA256(payload, secret))
//
// The token is self-contained — verification needs only the secret, no DB
// round-trip. Signed with a DEDICATED `CHILD_SESSION_SECRET` (NOT
// `BETTER_AUTH_SECRET`) so the child and parent auth domains have independent
// blast radius.
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface ChildTokenClaims {
  /** The authenticated child's id (children.id). */
  childId: string
  /** The owning parent account (user.id) — carried so handlers can scope. */
  parentId: string
  /** Issued-at, epoch ms. */
  iat: number
  /** Expiry, epoch ms. */
  exp: number
}

/**
 * 30 days. Child devices are long-lived and re-login is high-friction for a
 * young user on a registered device; the token is revocable in effect by
 * rotating the secret. Chosen deliberately (the source had no expiry at all).
 */
export const DEFAULT_CHILD_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

const base64urlEncode = (input: string): string => Buffer.from(input, 'utf8').toString('base64url')

const base64urlDecode = (input: string): string => Buffer.from(input, 'base64url').toString('utf8')

const sign = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url')

export interface MintChildTokenInput {
  childId: string
  parentId: string
}

export interface MintChildTokenOpts {
  ttlMs?: number
  now?: () => Date
}

/** Mint a signed child-session token. Called at child login. */
export function mintChildToken(
  input: MintChildTokenInput,
  secret: string,
  opts: MintChildTokenOpts = {},
): string {
  if (!secret) throw new Error('mintChildToken: secret is required')
  const nowMs = (opts.now?.() ?? new Date()).getTime()
  const ttl = opts.ttlMs ?? DEFAULT_CHILD_TOKEN_TTL_MS
  const claims: ChildTokenClaims = {
    childId: input.childId,
    parentId: input.parentId,
    iat: nowMs,
    exp: nowMs + ttl,
  }
  const payload = base64urlEncode(JSON.stringify(claims))
  return `${payload}.${sign(payload, secret)}`
}

/**
 * Verify a signed child-session token. Returns the claims on success, or `null`
 * for any malformed / tampered / wrong-secret / expired token (never throws on
 * bad input — an unauthenticated request must resolve to "no user", not a 500).
 */
export function verifyChildToken(
  token: string,
  secret: string,
  now: () => Date = () => new Date(),
): ChildTokenClaims | null {
  if (!secret) throw new Error('verifyChildToken: secret is required')
  if (typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, signature] = parts
  if (!payload || !signature) return null

  const expected = sign(payload, secret)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  // timingSafeEqual throws on unequal lengths — guard first, then compare in
  // constant time so a tampered signature can't be probed byte-by-byte.
  if (sigBuf.length !== expBuf.length) return null
  if (!timingSafeEqual(sigBuf, expBuf)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(base64urlDecode(payload)) as unknown
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { childId, parentId, iat, exp } = parsed as Record<string, unknown>
  if (
    typeof childId !== 'string' ||
    typeof parentId !== 'string' ||
    typeof iat !== 'number' ||
    typeof exp !== 'number'
  ) {
    return null
  }
  if (now().getTime() >= exp) return null
  return { childId, parentId, iat, exp }
}
