import { Handler, NotFoundError } from '@hoe/backend-kit'
import { z } from 'zod'

import type { FamilyStore } from '../../store.ts'
import { requireOwnChild, requireParent, type FamilyContext } from '../authz.ts'

import { toChildProfileView, type ChildProfileView } from './childProfileView.ts'

export const renameChildInputSchema = z.object({
  id: z.uuid(),
  displayName: z.string().trim().min(1).max(32),
})

export type RenameChildInput = z.infer<typeof renameChildInputSchema>

export class RenameChildHandler extends Handler<RenameChildInput, ChildProfileView, FamilyStore> {
  async run(input: RenameChildInput, ctx: FamilyContext): Promise<ChildProfileView> {
    const parent = requireParent(ctx)
    await requireOwnChild(ctx, parent.id, input.id)
    const renamed = await ctx.store.renameChildProfile({
      id: input.id,
      parentId: parent.id,
      displayName: input.displayName,
    })
    if (renamed === null) throw new NotFoundError('no such child profile')
    return toChildProfileView(renamed)
  }
}
