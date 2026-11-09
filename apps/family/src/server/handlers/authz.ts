import { ForbiddenError, NotFoundError, UnauthorizedError, type AppContext } from '@hoe/backend-kit'

import { isParentSession, type ParentUser } from '../auth/parentSession.ts'
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
