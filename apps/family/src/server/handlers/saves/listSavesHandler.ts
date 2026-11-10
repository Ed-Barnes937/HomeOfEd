import type { SaveListInput, SaveListOutput } from '@hoe/accounts'
import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import { requireOnboardedApp, requireSaveAccount, type FamilyContext } from '../authz.ts'

export class ListSavesHandler extends Handler<SaveListInput, SaveListOutput, FamilyStore> {
  async run(input: SaveListInput, ctx: FamilyContext): Promise<SaveListOutput> {
    const account = requireSaveAccount(ctx)
    requireOnboardedApp(input.appId)

    const slots = await ctx.store.listSaves({
      appId: input.appId,
      accountId: account.accountId,
    })
    return slots.map((slot) => ({
      slotKey: slot.slotKey,
      version: slot.version,
      sizeBytes: slot.sizeBytes,
      updatedAt: slot.updatedAt.getTime(),
    }))
  }
}
