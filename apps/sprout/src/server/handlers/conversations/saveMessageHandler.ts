import { ForbiddenError, Handler, NotFoundError, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { requireChild } from '../authz.ts'
import type { MessageDto } from './dto.ts'

export const saveMessageInputSchema = z.object({
  conversationId: z.string().uuid(),
  role: z.enum(['child', 'ai']),
  content: z.string().min(1),
  flagged: z.boolean().optional(),
})
export type SaveMessageInput = z.infer<typeof saveMessageInputSchema>

/**
 * conversations.saveMessage — the authenticated child appends a message to
 * their own conversation, then bumps `updatedAt` (source did this as two
 * writes in one handler; `touchConversation` mirrors that here). `childId`
 * comes from `ctx.auth`, never the input (#36) — the conversation must belong
 * to the authenticated child.
 */
export class SaveMessageHandler extends Handler<SaveMessageInput, MessageDto, SproutStore> {
  async run(input: SaveMessageInput, ctx: AppContext<SproutStore>): Promise<MessageDto> {
    const child = requireChild(ctx)
    const conversation = await ctx.store.getConversation(input.conversationId)
    if (!conversation) throw new NotFoundError('conversation not found')
    if (conversation.childId !== child.id) throw new ForbiddenError('not your conversation')

    const message = await ctx.store.addMessage({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      flagged: input.flagged ?? false,
    })
    await ctx.store.touchConversation(input.conversationId)

    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      flagged: message.flagged,
      createdAt: message.createdAt.toISOString(),
    }
  }
}
