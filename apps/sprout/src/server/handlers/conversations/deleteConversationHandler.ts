import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { authorizeConversationRead } from './access.ts'

export const deleteConversationInputSchema = z.object({ conversationId: z.string().uuid() })
export type DeleteConversationInput = z.infer<typeof deleteConversationInputSchema>

export interface DeleteConversationResult {
  success: true
}

/**
 * conversations.delete — SOFT-delete a conversation (pilot issue 03). In the
 * source app this is exclusively CHILD-initiated (the chat page's "Delete
 * conversation" button, after a conversation has been summarised) — there is
 * no parent-dashboard caller. We keep the same dual-role read authorization as
 * `list`/`messages`/`summary` rather than the stricter parent-only
 * `verifyConversationOwnership`, so the owning parent isn't locked out of a
 * future dashboard delete affordance while still matching today's real
 * (child-only) caller exactly.
 *
 * Soft, not hard: a row delete cascaded the conversation's messages AND its
 * safety flags away (schema.ts flags.conversationId/messageId), letting a
 * child erase exactly the history the parent-visibility posture depends on.
 * Setting `deletedAt` tidies the child's view while the parent keeps
 * everything; the retention worker remains the only path that purges content.
 */
export class DeleteConversationHandler extends Handler<
  DeleteConversationInput,
  DeleteConversationResult,
  SproutStore
> {
  async run(
    input: DeleteConversationInput,
    ctx: AppContext<SproutStore>,
  ): Promise<DeleteConversationResult> {
    await authorizeConversationRead(ctx, input.conversationId)
    await ctx.store.softDeleteConversation(input.conversationId)
    return { success: true }
  }
}
