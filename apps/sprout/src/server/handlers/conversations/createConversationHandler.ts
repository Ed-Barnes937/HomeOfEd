import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { requireChild } from '../authz.ts'
import type { ConversationDto } from './dto.ts'

export const createConversationInputSchema = z.object({
  title: z.string().min(1).optional(),
})
export type CreateConversationInput = z.infer<typeof createConversationInputSchema>

/**
 * conversations.create — the authenticated child starts a new conversation.
 * `childId` comes from `ctx.auth`, never the input: the source endpoint
 * (`handleCreateConversation`) took a client-supplied `childId` with no auth
 * at all — this migration closes that (#36).
 */
export class CreateConversationHandler extends Handler<
  CreateConversationInput,
  ConversationDto,
  SproutStore
> {
  async run(
    input: CreateConversationInput,
    ctx: AppContext<SproutStore>,
  ): Promise<ConversationDto> {
    const child = requireChild(ctx)
    const conversation = await ctx.store.createConversation({
      childId: child.id,
      title: input.title ?? null,
    })
    return {
      id: conversation.id,
      childId: conversation.childId,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    }
  }
}
