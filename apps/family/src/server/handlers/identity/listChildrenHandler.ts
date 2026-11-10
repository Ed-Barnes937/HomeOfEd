import type { ListChildrenOutput } from '@hoe/accounts'
import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import { requireParent, type FamilyContext } from '../authz.ts'

import { toChildProfileView } from './childProfileView.ts'

export class ListChildrenHandler extends Handler<void, ListChildrenOutput, FamilyStore> {
  async run(_input: void, ctx: FamilyContext): Promise<ListChildrenOutput> {
    const parent = requireParent(ctx)
    const profiles = await ctx.store.listChildProfiles(parent.id)
    return profiles.map(toChildProfileView)
  }
}
