import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import { requireParent, type FamilyContext } from '../authz.ts'

import { toChildProfileView, type ChildProfileView } from './childProfileView.ts'

export class ListChildrenHandler extends Handler<void, ChildProfileView[], FamilyStore> {
  async run(_input: void, ctx: FamilyContext): Promise<ChildProfileView[]> {
    const parent = requireParent(ctx)
    const profiles = await ctx.store.listChildProfiles(parent.id)
    return profiles.map(toChildProfileView)
  }
}
