// The one `ctx.auth` seam this service answers on, carrying both of its
// credentials ([ADR 0079](../../../../../docs/adr/0079-family-save-authorisation.md),
// after [ADR 0078](../../../../../docs/adr/0078-family-identity-auth-boundary.md)).
// Node-only: Ed25519 verification is node:crypto.
import { createPublicKey } from 'node:crypto'

import type { FamilyRole, FamilyUser } from '@hoe/accounts'
import { familyAuthProvider } from '@hoe/accounts/server'
import type { AuthProvider, User } from '@hoe/backend-kit'

import { isParentSession, type ParentUser } from './parentSession.ts'
import { parentSessionSeam } from './parentSessionBridge.ts'

/** Whose saves a request may touch: the verified family token's subject. */
export interface SaveAccount {
  accountId: string
  role: FamilyRole
  /** Set exactly when `role === 'child'`. */
  parentId?: string
}

/**
 * Both credentials can arrive on one request and need not name the same person
 * - a signed-in parent syncing a child's saves sends both - so each keeps its
 * own field, and `id` is the cookie session's alone.
 */
export type FamilySeamUser = User & {
  kind?: 'parent-session'
  saveAccount?: SaveAccount
}

const anonymous: AuthProvider = { getUser: () => null }

export function familySeam(
  publicKeyPem: string,
  now: () => Date = () => new Date(),
): (req: Request) => AuthProvider {
  const familyToken = familyAuthProvider(publicKeyPem, now)

  return (req) => {
    const parent = resolveParentSession(req)
    const saveAccount = resolveSaveAccount(familyToken(req))

    if (parent !== null) {
      const user: FamilySeamUser = {
        ...parent,
        ...(saveAccount === undefined ? {} : { saveAccount }),
      }
      return { getUser: () => user }
    }
    if (saveAccount === undefined) return anonymous

    const user: FamilySeamUser = { id: saveAccount.accountId, saveAccount }
    return { getUser: () => user }
  }
}

/** The verifying half of this service's own signing key, so the two cannot drift. */
export function publicKeyFromPrivateKey(privateKeyPem: string): string {
  return createPublicKey(privateKeyPem).export({ type: 'spki', format: 'pem' }).toString()
}

function resolveParentSession(req: Request): ParentUser | null {
  const user = parentSessionSeam(req).getUser()
  return user !== null && isParentSession(user) ? user : null
}

function resolveSaveAccount(provider: AuthProvider): SaveAccount | undefined {
  const user = provider.getUser() as FamilyUser | null
  if (user === null) return undefined
  return {
    accountId: user.id,
    role: user.role,
    ...(user.parentId === undefined ? {} : { parentId: user.parentId }),
  }
}
