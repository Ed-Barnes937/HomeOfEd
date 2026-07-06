import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'

export const removeTopicInputSchema = z.object({
  childId: z.string().uuid(),
  topicId: z.string().uuid(),
})
export type RemoveTopicInput = z.infer<typeof removeTopicInputSchema>

export interface RemoveTopicResult {
  success: true
}

/**
 * children.topics.remove — delete a seeded topic. Ownership is proven via the
 * `childId` (the parent must own the child); the topic is then removed by id.
 */
export class RemoveTopicHandler extends Handler<RemoveTopicInput, RemoveTopicResult, SproutStore> {
  async run(input: RemoveTopicInput, ctx: AppContext<SproutStore>): Promise<RemoveTopicResult> {
    await verifyChildOwnership(ctx, input.childId)
    await ctx.store.deleteParentSeededTopic(input.topicId)
    return { success: true }
  }
}
