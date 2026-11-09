import { Handler, UnauthorizedError } from '@hoe/backend-kit'
import { z } from 'zod'

import type { FamilyTokenMinter } from '../../auth/tokenPort.ts'
import type { FamilyStore } from '../../store.ts'
import { requireOwnChild, requireParent, type FamilyContext } from '../authz.ts'

export const mintSessionTokenInputSchema = z.object({
  /** Absent means the parent themselves. */
  childId: z.uuid().optional(),
})

export type MintSessionTokenInput = z.infer<typeof mintSessionTokenInputSchema>

export interface MintSessionTokenResult {
  token: string
}

/** "Who's playing": a family token for the parent or one of their own profiles. */
export class MintSessionTokenHandler extends Handler<
  MintSessionTokenInput,
  MintSessionTokenResult,
  FamilyStore
> {
  private readonly mintToken: FamilyTokenMinter

  constructor(mintToken: FamilyTokenMinter) {
    super()
    this.mintToken = mintToken
  }

  async run(input: MintSessionTokenInput, ctx: FamilyContext): Promise<MintSessionTokenResult> {
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
