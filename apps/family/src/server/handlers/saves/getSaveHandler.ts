import type { SaveGetInput, SaveGetOutput } from '@hoe/accounts'
import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import { requireOnboardedApp, requireSaveAccount, type FamilyContext } from '../authz.ts'

export class GetSaveHandler extends Handler<SaveGetInput, SaveGetOutput, FamilyStore> {
  async run(input: SaveGetInput, ctx: FamilyContext): Promise<SaveGetOutput> {
    const account = requireSaveAccount(ctx)
    requireOnboardedApp(input.appId)

    const record = await ctx.store.getSave({
      appId: input.appId,
      accountId: account.accountId,
      slotKey: input.slotKey,
    })
    return record === null
      ? null
      : { blob: record.blob, version: record.version, updatedAt: record.updatedAt.getTime() }
  }
}
