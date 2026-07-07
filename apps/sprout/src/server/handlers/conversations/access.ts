// Shared read-authorization for conversations.{list,messages,summary}. Unlike
// most of the backend, these three reads are legitimately dual-role in the
// source app: the parent dashboard (flag review / conversation-detail page)
// AND the conversation's own child (resuming a chat, the child home page's
// history list) hit the exact same source endpoints
// (`handleGetConversations`/`handleGetConversationMessages`). So each helper
// here accepts EITHER the owning parent (ownership proven via
// `verifyChildOwnership`) OR the conversation's/child's own authenticated
// child — never a client-supplied identity either way.
//
// Writes (create, saveMessage) and the parent-only destructive/administrative
// actions (delete, summariseAndPurge) do NOT use this file — they use
// `requireChild` or `verifyConversationOwnership` directly (see the handlers).
import { ForbiddenError, NotFoundError, UnauthorizedError, type AppContext } from '@hoe/backend-kit'

import type { SproutUser } from '../../auth/providers.ts'
import type { conversations } from '../../schema.ts'
import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'

type ConversationRow = typeof conversations.$inferSelect

/** Authorize a read of `childId`'s conversation list: the owning parent, or the child themself. */
export async function authorizeChildRead(
  ctx: AppContext<SproutStore>,
  childId: string,
): Promise<void> {
  const user = ctx.auth.getUser() as SproutUser | null
  if (!user) throw new UnauthorizedError('authentication required')
  if (user.role === 'parent') {
    await verifyChildOwnership(ctx, childId)
    return
  }
  if (user.id !== childId) throw new ForbiddenError('not your conversation history')
}

/**
 * Authorize a read of one conversation: the owning parent, or the
 * conversation's own child. Returns the loaded row so callers avoid a second
 * fetch (mirrors `verifyChildOwnership`'s "load once, reuse" shape).
 */
export async function authorizeConversationRead(
  ctx: AppContext<SproutStore>,
  conversationId: string,
): Promise<ConversationRow> {
  const conversation = await ctx.store.getConversation(conversationId)
  if (!conversation) throw new NotFoundError('conversation not found')

  const user = ctx.auth.getUser() as SproutUser | null
  if (!user) throw new UnauthorizedError('authentication required')
  if (user.role === 'parent') {
    await verifyChildOwnership(ctx, conversation.childId)
    return conversation
  }
  if (user.id !== conversation.childId) throw new ForbiddenError('not your conversation')
  return conversation
}
