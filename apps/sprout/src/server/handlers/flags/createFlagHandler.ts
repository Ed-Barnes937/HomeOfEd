import { ForbiddenError, Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import { recordEvent } from '../../behavioural-limits.ts'
import type { SproutStore } from '../../store.ts'
import { requireChild } from '../authz.ts'
import { flagTypeSchema } from './schemas.ts'

export const createFlagInputSchema = z.object({
  childId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  type: flagTypeSchema,
  reason: z.string().min(1),
  childMessage: z.string().optional(),
  aiResponse: z.string().optional(),
  topics: z.array(z.string()).optional(),
  deviceToken: z.string().optional(),
})
export type CreateFlagInput = z.infer<typeof createFlagInputSchema>

export interface CreateFlagResult {
  id: string
}

/**
 * flags.create — written on the chat path when a guardrail trips (or a child
 * reports a message). Child-scoped: `input.childId` must match the
 * authenticated child's own id. `topics` is stored as a JSON string (the
 * column is `text`, not jsonb — ported faithfully from the source). Every
 * flag EXCEPT a child-initiated `reported` also records a `probe`
 * behavioural signal (repeated-probe / device-reputation tracking) —
 * `reported` is excluded because it isn't the guardrails tripping, it's the
 * child flagging something themselves.
 */
export class CreateFlagHandler extends Handler<CreateFlagInput, CreateFlagResult, SproutStore> {
  async run(input: CreateFlagInput, ctx: AppContext<SproutStore>): Promise<CreateFlagResult> {
    const child = requireChild(ctx)
    if (input.childId !== child.id) {
      throw new ForbiddenError('not your session')
    }

    const flag = await ctx.store.createFlag({
      childId: input.childId,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      type: input.type,
      reason: input.reason,
      childMessage: input.childMessage ?? null,
      aiResponse: input.aiResponse ?? null,
      topics: input.topics ? JSON.stringify(input.topics) : null,
    })

    if (input.type !== 'reported') {
      await recordEvent(ctx.store, {
        kind: 'probe',
        childId: input.childId,
        deviceToken: input.deviceToken,
      })
    }

    return { id: flag.id }
  }
}
