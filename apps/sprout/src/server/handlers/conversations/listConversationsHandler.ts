import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutUser } from '../../auth/providers.ts'
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
 *
 * Soft-deleted conversations (pilot issue 03) split the views: the child's own
 * list excludes them (their delete tidied the list); the parent's includes
 * them, `deletedAt` set, so the dashboard can label them deleted-by-child.
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
    const isChild = (ctx.auth.getUser() as SproutUser | null)?.role === 'child'
    const rows = await ctx.store.listConversationsByChild(input.childId, {
      excludeDeleted: isChild,
    })
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      deletedAt: c.deletedAt?.toISOString() ?? null,
    }))
  }
}
