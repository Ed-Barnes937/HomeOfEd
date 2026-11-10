import { SAVE_ACCOUNT_MISMATCH } from '@hoe/accounts'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type AppContext,
} from '@hoe/backend-kit'

import type { FamilySeamUser, SaveAccount } from '../auth/familySeam.ts'
import { isParentSession, type ParentUser } from '../auth/parentSession.ts'
import { isOnboardedApp } from '../onboardedApps.ts'
import type { ChildProfileRow, FamilyStore } from '../store.ts'

export type FamilyContext = AppContext<FamilyStore>

/** Identity procedures are authorised by the Better Auth cookie session alone. */
export function requireParent(ctx: FamilyContext): ParentUser {
  const user = ctx.auth.getUser()
  if (user === null || !isParentSession(user)) {
    throw new UnauthorizedError('parent authentication required')
  }
  return user
}

const FAMILY_ROLES: readonly string[] = ['parent', 'child']

/**
 * Save procedures are authorised by the family session token alone, and this is
 * the mirror of `requireParent`: only a verified token puts a role on the seam,
 * and a parent's cookie session resolves there too but must never reach the
 * SaveStore. The returned `accountId` is the only account a procedure may touch.
 */
export function requireSaveAccount(ctx: FamilyContext): SaveAccount {
  const user = ctx.auth.getUser()
  const account = user === null ? undefined : (user as Partial<FamilySeamUser>).saveAccount
  if (account === undefined || !FAMILY_ROLES.includes(account.role)) {
    throw new UnauthorizedError('a family session token is required')
  }
  return account
}

/** A page bound to one profile is refused another's slot, even under that profile's token. */
export function requireExpectedAccount(account: SaveAccount, expectedAccountId?: string): void {
  if (expectedAccountId !== undefined && expectedAccountId !== account.accountId) {
    throw new ConflictError(SAVE_ACCOUNT_MISMATCH)
  }
}

/** The SaveStore serves onboarded apps only, so it never becomes a dumping ground. */
export function requireOnboardedApp(appId: string): void {
  if (!isOnboardedApp(appId)) {
    throw new ValidationError(`${appId} is not an app this service stores saves for`)
  }
}

/** A child profile the signed-in parent really owns, or a typed refusal. */
export async function requireOwnChild(
  ctx: FamilyContext,
  parentId: string,
  childId: string,
): Promise<ChildProfileRow> {
  const profile = await ctx.store.getChildProfile(childId)
  if (profile === null) throw new NotFoundError('no such child profile')
  if (profile.parentId !== parentId) throw new ForbiddenError('that child profile is not yours')
  return profile
}
