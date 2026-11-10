import type { DeleteAccountOutput } from '@hoe/accounts'
import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import { requireParent, type FamilyContext } from '../authz.ts'

/** Erases the household: the parent, its profiles, and every save row they own. */
export class DeleteAccountHandler extends Handler<void, DeleteAccountOutput, FamilyStore> {
  async run(_input: void, ctx: FamilyContext): Promise<DeleteAccountOutput> {
    const parent = requireParent(ctx)
    await ctx.store.deleteAccount(parent.id)
    return { ok: true }
  }
}
