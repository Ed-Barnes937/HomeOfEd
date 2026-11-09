import { Handler } from '@hoe/backend-kit'
import { z } from 'zod'

import type { FamilyStore } from '../../store.ts'
import { requireParent, type FamilyContext } from '../authz.ts'

import { toChildProfileView, type ChildProfileView } from './childProfileView.ts'

export const addChildInputSchema = z.object({
  username: z.string().trim().min(1).max(32),
  displayName: z.string().trim().min(1).max(32),
})

export type AddChildInput = z.infer<typeof addChildInputSchema>

export class AddChildHandler extends Handler<AddChildInput, ChildProfileView, FamilyStore> {
  async run(input: AddChildInput, ctx: FamilyContext): Promise<ChildProfileView> {
    const parent = requireParent(ctx)
    const profile = await ctx.store.addChildProfile({ ...input, parentId: parent.id })
    return toChildProfileView(profile)
  }
}
