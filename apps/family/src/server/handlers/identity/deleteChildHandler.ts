import { Handler } from '@hoe/backend-kit'
import { z } from 'zod'

import type { FamilyStore } from '../../store.ts'
import { requireOwnChild, requireParent, type FamilyContext } from '../authz.ts'

export const deleteChildInputSchema = z.object({ id: z.uuid() })

export type DeleteChildInput = z.infer<typeof deleteChildInputSchema>

export interface DeleteChildResult {
  ok: true
}

export class DeleteChildHandler extends Handler<DeleteChildInput, DeleteChildResult, FamilyStore> {
  async run(input: DeleteChildInput, ctx: FamilyContext): Promise<DeleteChildResult> {
    const parent = requireParent(ctx)
    await requireOwnChild(ctx, parent.id, input.id)
    await ctx.store.deleteChildProfile({ id: input.id, parentId: parent.id })
    return { ok: true }
  }
}
