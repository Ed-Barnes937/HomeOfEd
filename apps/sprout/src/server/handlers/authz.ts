// Shared authorization helpers for handler classes (resolves review #34/#35).
//
// The rule the whole backend follows: identity comes from `ctx.auth`, NEVER
// from the request input. A child-scoped procedure derives the authenticated
// `parentId`, then proves the target child belongs to that parent against the
// Store. P3b's conversations/flags groups reuse `requireParent`, and should add
// a `verifyConversationOwnership` here in the same shape (load conversation →
// child → compare parentId).
import { ForbiddenError, NotFoundError, UnauthorizedError, type AppContext } from '@hoe/backend-kit'

import type { ChildUser, ParentUser, SproutUser } from '../auth/providers.ts'
import type { SproutStore } from '../store.ts'

type ChildRow = Awaited<ReturnType<SproutStore['getChild']>>
type ConversationRow = Awaited<ReturnType<SproutStore['getConversation']>>

/**
 * Narrow `ctx.auth` to an authenticated parent. Throws `UnauthorizedError`
 * (401) if there is no user or the user is not a parent. Every parent-scoped
 * procedure calls this first — the returned `id` is the ONLY trusted source of
 * `parentId`.
 */
export function requireParent(ctx: AppContext<SproutStore>): ParentUser {
  const user = ctx.auth.getUser() as SproutUser | null
  if (!user || user.role !== 'parent') {
    throw new UnauthorizedError('parent authentication required')
  }
  return user
}

/** Narrow `ctx.auth` to an authenticated child (childAuth-scoped procedures). */
export function requireChild(ctx: AppContext<SproutStore>): ChildUser {
  const user = ctx.auth.getUser() as SproutUser | null
  if (!user || user.role !== 'child') {
    throw new UnauthorizedError('child authentication required')
  }
  return user
}

/**
 * The core ownership check: the authenticated parent must own `childId`.
 * Throws `NotFoundError` (404) if the child does not exist, `ForbiddenError`
 * (403) if it belongs to a different parent (the cross-family IDOR guard).
 * Returns the loaded parent + child row so callers avoid a second read.
 */
export async function verifyChildOwnership(
  ctx: AppContext<SproutStore>,
  childId: string,
): Promise<{ parent: ParentUser; child: NonNullable<ChildRow> }> {
  const parent = requireParent(ctx)
  const child = await ctx.store.getChild(childId)
  if (!child) throw new NotFoundError('child not found')
  if (child.parentId !== parent.id) throw new ForbiddenError('not your child')
  return { parent, child }
}

/**
 * The conversation-scoped ownership check (P3b / plan §5.1): a conversation is
 * owned via its child, so this loads the conversation then delegates to
 * `verifyChildOwnership` for the actual cross-family 403 guard. Throws
 * `NotFoundError` (404) if the conversation itself doesn't exist. This is the
 * PARENT-side check (dashboard actions); several conversation procedures are
 * also self-served by the conversation's own child (chat history/writes) —
 * that dual-role branching lives per-handler in
 * `handlers/conversations/access.ts`, not here, so this helper stays a single,
 * unambiguous "does this parent own this conversation" primitive.
 */
export async function verifyConversationOwnership(
  ctx: AppContext<SproutStore>,
  conversationId: string,
): Promise<{
  parent: ParentUser
  child: NonNullable<ChildRow>
  conversation: NonNullable<ConversationRow>
}> {
  const conversation = await ctx.store.getConversation(conversationId)
  if (!conversation) throw new NotFoundError('conversation not found')
  const { parent, child } = await verifyChildOwnership(ctx, conversation.childId)
  return { parent, child, conversation }
}
