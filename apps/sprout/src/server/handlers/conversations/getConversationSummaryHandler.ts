import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { authorizeConversationRead } from './access.ts'

export const getConversationSummaryInputSchema = z.object({ conversationId: z.string().uuid() })
export type GetConversationSummaryInput = z.infer<typeof getConversationSummaryInputSchema>

export interface ConversationSummaryResult {
  summary: string | null
}

/**
 * conversations.summary — a conversation's (possibly null) summary. Read by
 * BOTH the owning parent and the conversation's own child, same as `messages`
 * (source's `handleGetConversationSummary` has no auth at all today).
 */
export class GetConversationSummaryHandler extends Handler<
  GetConversationSummaryInput,
  ConversationSummaryResult,
  SproutStore
> {
  async run(
    input: GetConversationSummaryInput,
    ctx: AppContext<SproutStore>,
  ): Promise<ConversationSummaryResult> {
    const conversation = await authorizeConversationRead(ctx, input.conversationId)
    return { summary: conversation.summary }
  }
}
