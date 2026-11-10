import type { AddChildInput, ChildProfileView } from '@hoe/accounts'
import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import { requireParent, type FamilyContext } from '../authz.ts'

import { toChildProfileView } from './childProfileView.ts'

export class AddChildHandler extends Handler<AddChildInput, ChildProfileView, FamilyStore> {
  async run(input: AddChildInput, ctx: FamilyContext): Promise<ChildProfileView> {
    const parent = requireParent(ctx)
    const profile = await ctx.store.addChildProfile({ ...input, parentId: parent.id })
    return toChildProfileView(profile)
  }
}
