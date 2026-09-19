import type { AuthProvider, User } from '@hoe/backend-kit'

import type { FamilyRole } from './claims.ts'
import { readFamilyTokenFromCookieHeader } from './claims.ts'
import { verifyFamilyToken } from './familyToken.ts'

export type FamilyUser = User & {
  role: FamilyRole
  /** Set exactly when `role === 'child'`. */
  parentId?: string
  /** Display only; never read by an authorisation check. */
  name: string
}

/** Any missing, tampered or expired token resolves to no user, never an error. */
export function familyAuthProvider(
  publicKeyPem: string,
  now: () => Date = () => new Date(),
): (req: Request) => AuthProvider {
  if (!publicKeyPem) throw new Error('familyAuthProvider: publicKeyPem is required')
  return (req) => {
    const token = readFamilyTokenFromCookieHeader(req.headers.get('cookie'))
    const claims = token ? verifyFamilyToken(token, publicKeyPem, now) : null
    const user: FamilyUser | null = claims
      ? {
          id: claims.sub,
          role: claims.role,
          ...(claims.parentId !== undefined ? { parentId: claims.parentId } : {}),
          name: claims.name,
        }
      : null
    return { getUser: () => user }
  }
}
