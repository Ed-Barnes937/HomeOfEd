import type { SaveDeleteInput, SaveDeleteOutput } from '@hoe/accounts'
import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import {
  requireExpectedAccount,
  requireOnboardedApp,
  requireSaveAccount,
  type FamilyContext,
} from '../authz.ts'

export class DeleteSaveHandler extends Handler<SaveDeleteInput, SaveDeleteOutput, FamilyStore> {
  async run(input: SaveDeleteInput, ctx: FamilyContext): Promise<SaveDeleteOutput> {
    const account = requireSaveAccount(ctx)
    requireExpectedAccount(account, input.expectedAccountId)
    requireOnboardedApp(input.appId)

    await ctx.store.deleteSave({
      appId: input.appId,
      accountId: account.accountId,
      slotKey: input.slotKey,
    })
    return {}
  }
}
