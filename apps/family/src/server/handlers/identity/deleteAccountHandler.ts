import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import { requireParent, type FamilyContext } from '../authz.ts'

export interface DeleteAccountResult {
  ok: true
}

/** Erases the household: the parent, its profiles, and every save row they own. */
export class DeleteAccountHandler extends Handler<void, DeleteAccountResult, FamilyStore> {
  async run(_input: void, ctx: FamilyContext): Promise<DeleteAccountResult> {
    const parent = requireParent(ctx)
    await ctx.store.deleteAccount(parent.id)
    return { ok: true }
  }
}
