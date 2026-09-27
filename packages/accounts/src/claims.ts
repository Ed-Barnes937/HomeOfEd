export const FAMILY_SESSION_COOKIE = 'hoe_family_session'

export type FamilyRole = 'parent' | 'child'

export interface FamilyTokenClaims {
  /** `user.id` (parent) or `child_profiles.id` (child). */
  sub: string
  role: FamilyRole
  /** Set exactly when `role === 'child'`. */
  parentId?: string
  /** Display only; never read by an authorisation check. */
  name: string
  /** Epoch ms, not the JWT convention of seconds. */
  iat: number
  exp: number
}

export function validateClaimsShape(parsed: unknown): FamilyTokenClaims | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  const { sub, role, parentId, name, iat, exp } = parsed as Record<string, unknown>
  if (typeof sub !== 'string' || sub === '') return null
  if (role !== 'parent' && role !== 'child') return null
  if (role === 'child' && typeof parentId !== 'string') return null
  if (role === 'parent' && parentId !== undefined) return null
  if (typeof name !== 'string') return null
  if (typeof iat !== 'number' || typeof exp !== 'number') return null
  return role === 'child'
    ? { sub, role, parentId: parentId as string, name, iat, exp }
    : { sub, role, name, iat, exp }
}

export const DEFAULT_FAMILY_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Split `base64url(JSON).base64url(sig)`; null for anything else-shaped. */
export function splitToken(token: string): { payload: string; signature: string } | null {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, signature] = parts
  if (!payload || !signature) return null
  return { payload, signature }
}

export function isExpired(claims: FamilyTokenClaims, now: () => Date): boolean {
  return now().getTime() >= claims.exp
}

/** Does NOT verify the signature; anything authorising must use `verifyFamilyToken`. */
export function decodeTokenPayload(token: string): unknown {
  const parts = splitToken(token)
  if (parts === null) return null
  const json = base64urlDecodeUtf8(parts.payload)
  if (json === null) return null
  try {
    return JSON.parse(json) as unknown
  } catch {
    return null
  }
}

export function readFamilyTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === FAMILY_SESSION_COOKIE) return part.slice(eq + 1).trim()
  }
  return null
}

// Avoids Buffer so the same code runs in the browser and in node.
function base64urlDecodeUtf8(input: string): string | null {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}
