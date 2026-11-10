import type { IdentityMeOutput } from '@hoe/accounts'
import { Handler } from '@hoe/backend-kit'

import { isParentSession } from '../../auth/parentSession.ts'
import type { FamilyStore } from '../../store.ts'
import type { FamilyContext } from '../authz.ts'

/** Null rather than a refusal: this is how hub asks "is anyone signed in?". */
export class MeHandler extends Handler<void, IdentityMeOutput, FamilyStore> {
  async run(_input: void, ctx: FamilyContext): Promise<IdentityMeOutput> {
    const user = ctx.auth.getUser()
    if (user === null || !isParentSession(user)) return { parent: null }
    const parent = await ctx.store.getParent(user.id)
    if (parent === null) return { parent: null }
    return { parent: { id: parent.id, name: parent.name, email: parent.email } }
  }
}
