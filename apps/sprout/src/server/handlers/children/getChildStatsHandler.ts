import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'

export const getChildStatsInputSchema = z.object({ childId: z.string().uuid() })
export type GetChildStatsInput = z.infer<typeof getChildStatsInputSchema>

export interface ChildStats {
  messageCount: number
  conversationCount: number
  topTopics: string[]
  flagCount: number
  lastActive: string | null
}

/**
 * children.stats — dashboard rollup for one owned child: message/conversation
 * counts, the most-flagged topics, the count of UNREVIEWED flags, and the last
 * active timestamp. Read-only aggregation over the Store.
 */
export class GetChildStatsHandler extends Handler<GetChildStatsInput, ChildStats, SproutStore> {
  async run(input: GetChildStatsInput, ctx: AppContext<SproutStore>): Promise<ChildStats> {
    const { child } = await verifyChildOwnership(ctx, input.childId)

    const convos = await ctx.store.listConversationsByChild(child.id)
    const messageCount = await ctx.store.countMessagesByConversations(convos.map((c) => c.id))
    const childFlags = await ctx.store.listFlagsByChild(child.id)

    const topicCounts: Record<string, number> = {}
    for (const flag of childFlags) {
      if (!flag.topics) continue
      const parsed = JSON.parse(flag.topics) as string[]
      for (const topic of parsed) {
        topicCounts[topic] = (topicCounts[topic] ?? 0) + 1
      }
    }
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic)

    const flagCount = childFlags.filter((f) => !f.reviewed).length

    const lastActive =
      convos.length > 0
        ? convos
            .map((c) => c.updatedAt.getTime())
            .reduce((max, t) => Math.max(max, t), 0)
        : null

    return {
      messageCount,
      conversationCount: convos.length,
      topTopics,
      flagCount,
      lastActive: lastActive === null ? null : new Date(lastActive).toISOString(),
    }
  }
}
