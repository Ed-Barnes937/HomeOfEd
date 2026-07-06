import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { authorizeConversationRead } from './access.ts'
import type { MessageDto } from './dto.ts'

export const listMessagesInputSchema = z.object({ conversationId: z.string().uuid() })
export type ListMessagesInput = z.infer<typeof listMessagesInputSchema>

/**
 * conversations.messages — a conversation's messages, oldest-first. Read by
 * BOTH the owning parent (the flag-review conversation-detail page) and the
 * conversation's own child (resuming a chat) — mirrors source's shared
 * `handleGetConversationMessages` endpoint used by both callers.
 */
export class ListMessagesHandler extends Handler<ListMessagesInput, MessageDto[], SproutStore> {
  async run(input: ListMessagesInput, ctx: AppContext<SproutStore>): Promise<MessageDto[]> {
    await authorizeConversationRead(ctx, input.conversationId)
    const rows = await ctx.store.listMessages(input.conversationId)
    return rows.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      flagged: m.flagged,
      createdAt: m.createdAt.toISOString(),
    }))
  }
}
