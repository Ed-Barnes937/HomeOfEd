import { compareSaveSummaryEntries, type SaveSummaryOutput } from '@hoe/accounts'
import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import { requireParent, type FamilyContext } from '../authz.ts'

/** Cookie-session only, like every identity procedure: a family token never reaches it. */
export class SaveSummaryHandler extends Handler<void, SaveSummaryOutput, FamilyStore> {
  async run(_input: void, ctx: FamilyContext): Promise<SaveSummaryOutput> {
    const parent = requireParent(ctx)
    const rows = await ctx.store.saveSummary(parent.id)
    return rows
      .map((row) => ({
        accountId: row.accountId,
        appId: row.appId,
        updatedAt: row.updatedAt.getTime(),
      }))
      .sort(compareSaveSummaryEntries)
  }
}
