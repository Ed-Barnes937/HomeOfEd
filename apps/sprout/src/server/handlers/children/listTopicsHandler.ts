import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'

export const listTopicsInputSchema = z.object({ childId: z.string().uuid() })
export type ListTopicsInput = z.infer<typeof listTopicsInputSchema>

export interface ParentSeededTopic {
  id: string
  childId: string
  topic: string
  createdAt: string
}

/** children.topics.list — parent-seeded topics for an owned child, newest-first. */
export class ListTopicsHandler extends Handler<ListTopicsInput, ParentSeededTopic[], SproutStore> {
  async run(input: ListTopicsInput, ctx: AppContext<SproutStore>): Promise<ParentSeededTopic[]> {
    const { child } = await verifyChildOwnership(ctx, input.childId)
    const rows = await ctx.store.listParentSeededTopics(child.id)
    return rows.map((r) => ({
      id: r.id,
      childId: r.childId,
      topic: r.topic,
      createdAt: r.createdAt.toISOString(),
    }))
  }
}
