import { sign, verify } from 'node:crypto'

import type { FamilyRole, FamilyTokenClaims } from './claims.ts'
import {
  DEFAULT_FAMILY_TOKEN_TTL_MS,
  decodeTokenPayload,
  isExpired,
  splitToken,
  validateClaimsShape,
} from './claims.ts'

export { DEFAULT_FAMILY_TOKEN_TTL_MS }

export interface MintFamilyTokenInput {
  sub: string
  role: FamilyRole
  /** Required when role === 'child', forbidden otherwise. */
  parentId?: string
  name: string
}

export interface MintFamilyTokenOpts {
  ttlMs?: number
  now?: () => Date
}

export function mintFamilyToken(
  input: MintFamilyTokenInput,
  privateKeyPem: string,
  opts: MintFamilyTokenOpts = {},
): string {
  if (!privateKeyPem) throw new Error('mintFamilyToken: privateKeyPem is required')
  if (input.role === 'child' && !input.parentId)
    throw new Error('mintFamilyToken: a child token requires parentId')
  if (input.role === 'parent' && input.parentId !== undefined)
    throw new Error('mintFamilyToken: a parent token must not carry parentId')
  const nowMs = (opts.now?.() ?? new Date()).getTime()
  const claims: FamilyTokenClaims = {
    sub: input.sub,
    role: input.role,
    ...(input.role === 'child' ? { parentId: input.parentId } : {}),
    name: input.name,
    iat: nowMs,
    exp: nowMs + (opts.ttlMs ?? DEFAULT_FAMILY_TOKEN_TTL_MS),
  }
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  const signature = sign(null, Buffer.from(payload, 'utf8'), privateKeyPem).toString('base64url')
  return `${payload}.${signature}`
}

/** Total over token input: any bad token is null. Only a missing key throws. */
export function verifyFamilyToken(
  token: string,
  publicKeyPem: string,
  now: () => Date = () => new Date(),
): FamilyTokenClaims | null {
  if (!publicKeyPem) throw new Error('verifyFamilyToken: publicKeyPem is required')

  const parts = splitToken(token)
  if (parts === null) return null

  let valid: boolean
  try {
    valid = verify(
      null,
      Buffer.from(parts.payload, 'utf8'),
      publicKeyPem,
      Buffer.from(parts.signature, 'base64url'),
    )
  } catch {
    // Ed25519 throws on odd-length signature buffers; still just a bad token.
    return null
  }
  if (!valid) return null

  const claims = validateClaimsShape(decodeTokenPayload(token))
  if (claims === null) return null
  if (isExpired(claims, now)) return null
  return claims
}
