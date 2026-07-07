import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { Summariser } from '../../router/deps.ts'
import type { SproutStore } from '../../store.ts'
import { verifyConversationOwnership } from '../authz.ts'

export const summariseAndPurgeInputSchema = z.object({ conversationId: z.string().uuid() })
export type SummariseAndPurgeInput = z.infer<typeof summariseAndPurgeInputSchema>

export interface SummariseAndPurgeResult {
  summary: string
}

/**
 * conversations.summariseAndPurge — compresses a conversation to a summary via
 * the injected pipeline seam (`deps.summarise`, a P5 TODO — DO NOT call the
 * pipeline HTTP endpoint here) and purges its messages atomically. Not called
 * from any screen in the source app (it's exercised only against the raw
 * backend-simulator DB, and is presumably the retention worker's flow made
 * callable on demand) — no caller evidence exists either way, so this is
 * PARENT-scoped (`verifyConversationOwnership`) as the conservative default
 * for a destructive/compliance action, unlike the dual-role reads.
 */
export class SummariseAndPurgeHandler extends Handler<
  SummariseAndPurgeInput,
  SummariseAndPurgeResult,
  SproutStore
> {
  private readonly summarise: Summariser

  constructor(summarise: Summariser) {
    super()
    this.summarise = summarise
  }

  async run(
    input: SummariseAndPurgeInput,
    ctx: AppContext<SproutStore>,
  ): Promise<SummariseAndPurgeResult> {
    const { conversation } = await verifyConversationOwnership(ctx, input.conversationId)
    const messages = await ctx.store.listMessages(input.conversationId)

    if (messages.length === 0) {
      return { summary: conversation.summary ?? '' }
    }

    const summary = await this.summarise(
      messages.map((m) => ({ role: m.role, content: m.content })),
    )
    await ctx.store.summariseAndPurgeConversation(input.conversationId, summary)
    return { summary }
  }
}
