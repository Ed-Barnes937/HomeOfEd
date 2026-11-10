import type { DeleteChildInput, DeleteChildOutput } from '@hoe/accounts'
import { Handler } from '@hoe/backend-kit'

import type { FamilyStore } from '../../store.ts'
import { requireOwnChild, requireParent, type FamilyContext } from '../authz.ts'

export class DeleteChildHandler extends Handler<DeleteChildInput, DeleteChildOutput, FamilyStore> {
  async run(input: DeleteChildInput, ctx: FamilyContext): Promise<DeleteChildOutput> {
    const parent = requireParent(ctx)
    await requireOwnChild(ctx, parent.id, input.id)
    await ctx.store.deleteChildProfile({ id: input.id, parentId: parent.id })
    return { ok: true }
  }
}
