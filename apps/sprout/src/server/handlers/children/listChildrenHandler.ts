import { Handler, type AppContext } from '@hoe/backend-kit'

import type { PresetName } from '@hoe/sprout-shared'
import type { SproutStore } from '../../store.ts'
import { requireParent } from '../authz.ts'

export interface ChildSummary {
  id: string
  displayName: string
  username: string
  presetName: PresetName
}

/**
 * children.list — every child owned by the authenticated parent. `parentId`
 * comes from `ctx.auth` (never input), so a parent only ever sees their own.
 */
export class ListChildrenHandler extends Handler<void, ChildSummary[], SproutStore> {
  async run(_input: void, ctx: AppContext<SproutStore>): Promise<ChildSummary[]> {
    const parent = requireParent(ctx)
    const rows = await ctx.store.listChildrenByParent(parent.id)
    return rows.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      username: c.username,
      presetName: c.presetName as PresetName,
    }))
  }
}
