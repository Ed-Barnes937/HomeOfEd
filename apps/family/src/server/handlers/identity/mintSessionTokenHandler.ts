import type { MintSessionTokenInput, MintSessionTokenOutput } from '@hoe/accounts'
import { Handler, UnauthorizedError } from '@hoe/backend-kit'

import type { FamilyTokenMinter } from '../../auth/tokenPort.ts'
import type { FamilyStore } from '../../store.ts'
import { requireOwnChild, requireParent, type FamilyContext } from '../authz.ts'

/** "Who's playing": a family token for the parent or one of their own profiles. */
export class MintSessionTokenHandler extends Handler<
  MintSessionTokenInput,
  MintSessionTokenOutput,
  FamilyStore
> {
  private readonly mintToken: FamilyTokenMinter

  constructor(mintToken: FamilyTokenMinter) {
    super()
    this.mintToken = mintToken
  }

  async run(input: MintSessionTokenInput, ctx: FamilyContext): Promise<MintSessionTokenOutput> {
    const parent = requireParent(ctx)

    if (input.childId === undefined) {
      const row = await ctx.store.getParent(parent.id)
      if (row === null) throw new UnauthorizedError('parent authentication required')
      return { token: this.mintToken({ sub: row.id, role: 'parent', name: row.name }) }
    }

    const child = await requireOwnChild(ctx, parent.id, input.childId)
    return {
      token: this.mintToken({
        sub: child.id,
        role: 'child',
        parentId: parent.id,
        name: child.displayName,
      }),
    }
  }
}
