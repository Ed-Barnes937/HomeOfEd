import { Handler, NotFoundError, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import { toFlagRecord, type FlagRecord } from './schemas.ts'

export const reviewFlagInputSchema = z.object({
  flagId: z.string().uuid(),
  reviewed: z.boolean(),
})
export type ReviewFlagInput = z.infer<typeof reviewFlagInputSchema>

/**
 * flags.review — the flag review state machine, which is just the boolean
 * `reviewed` toggle (unreviewed -> reviewed; there is no richer status in the
 * source). Parent-scoped: loads the flag, then proves the parent owns the
 * flag's child (403 cross-family) before flipping it.
 */
export class ReviewFlagHandler extends Handler<ReviewFlagInput, FlagRecord, SproutStore> {
  async run(input: ReviewFlagInput, ctx: AppContext<SproutStore>): Promise<FlagRecord> {
    const flag = await ctx.store.getFlag(input.flagId)
    if (!flag) throw new NotFoundError('flag not found')

    await verifyChildOwnership(ctx, flag.childId)

    const updated = await ctx.store.setFlagReviewed(input.flagId, input.reviewed)
    if (!updated) throw new NotFoundError('flag not found')

    return toFlagRecord(updated)
  }
}
