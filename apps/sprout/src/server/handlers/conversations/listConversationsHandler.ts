import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { authorizeChildRead } from './access.ts'
import type { ConversationSummaryDto } from './dto.ts'

export const listConversationsInputSchema = z.object({ childId: z.string().uuid() })
export type ListConversationsInput = z.infer<typeof listConversationsInputSchema>

/**
 * conversations.list — a child's conversations, newest-first. Read by BOTH the
 * owning parent (dashboard) and the child themself (their own chat history) —
 * source's child home page and any future parent dashboard view hit the same
 * `handleGetConversations` endpoint.
 */
export class ListConversationsHandler extends Handler<
  ListConversationsInput,
  ConversationSummaryDto[],
  SproutStore
> {
  async run(
    input: ListConversationsInput,
    ctx: AppContext<SproutStore>,
  ): Promise<ConversationSummaryDto[]> {
    await authorizeChildRead(ctx, input.childId)
    const rows = await ctx.store.listConversationsByChild(input.childId)
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  }
}
