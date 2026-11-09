import type { SavePutInput, SavePutOutput } from '@hoe/accounts'
import { Handler, ValidationError } from '@hoe/backend-kit'

import { blobByteLength, type FamilyStore, type SaveKey } from '../../store.ts'
import { requireOnboardedApp, requireSaveAccount, type FamilyContext } from '../authz.ts'

import { MAX_ACCOUNT_BYTES, MAX_ACCOUNT_SLOTS, MAX_SLOT_BYTES } from './limits.ts'

export class PutSaveHandler extends Handler<SavePutInput, SavePutOutput, FamilyStore> {
  async run(input: SavePutInput, ctx: FamilyContext): Promise<SavePutOutput> {
    const account = requireSaveAccount(ctx)
    requireOnboardedApp(input.appId)

    const key: SaveKey = {
      appId: input.appId,
      accountId: account.accountId,
      slotKey: input.slotKey,
    }
    const sizeBytes = blobByteLength(input.blob)
    if (sizeBytes > MAX_SLOT_BYTES) {
      throw new ValidationError(
        `a save slot holds at most ${MAX_SLOT_BYTES} bytes; this one is ${sizeBytes}`,
      )
    }

    const usage = await ctx.store.saveUsage(key)
    if (usage.accountBytes - usage.slotBytes + sizeBytes > MAX_ACCOUNT_BYTES) {
      throw new ValidationError(
        `this account holds at most ${MAX_ACCOUNT_BYTES} bytes of saves across every app`,
      )
    }
    if (!usage.slotExists && usage.accountSlots >= MAX_ACCOUNT_SLOTS) {
      throw new ValidationError(
        `this account holds at most ${MAX_ACCOUNT_SLOTS} save slots across every app`,
      )
    }

    return ctx.store.putSave({ ...key, blob: input.blob })
  }
}
