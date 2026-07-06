import { Handler, ValidationError, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import type { ParentSeededTopic } from './listTopicsHandler.ts'

const MAX_TOPIC_LENGTH = 200

export const addTopicInputSchema = z.object({
  childId: z.string().uuid(),
  topic: z.string(),
})
export type AddTopicInput = z.infer<typeof addTopicInputSchema>

/**
 * children.topics.add — seed a sensitive topic for an owned child. Trimmed and
 * length-checked server-side (1..200 chars) as a backstop to the column limit;
 * `.length` over-counts astral chars vs varchar(200), so anything that passes
 * fits without truncation.
 */
export class AddTopicHandler extends Handler<AddTopicInput, ParentSeededTopic, SproutStore> {
  async run(input: AddTopicInput, ctx: AppContext<SproutStore>): Promise<ParentSeededTopic> {
    const { child } = await verifyChildOwnership(ctx, input.childId)

    const trimmed = input.topic.trim()
    if (trimmed.length === 0 || trimmed.length > MAX_TOPIC_LENGTH) {
      throw new ValidationError(`Topic must be between 1 and ${MAX_TOPIC_LENGTH} characters.`)
    }

    const row = await ctx.store.createParentSeededTopic(child.id, trimmed)
    return {
      id: row.id,
      childId: row.childId,
      topic: row.topic,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
