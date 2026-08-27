import { Handler, NotFoundError, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import { clearPinFailures } from '../../behavioural-limits.ts'
import type { PresetName } from '@hoe/sprout-shared'
import type { PasswordHasher } from '../../password.ts'
import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import type { ChildSummary } from './listChildrenHandler.ts'

export const resetPinInputSchema = z.object({
  childId: z.string().uuid(),
})
export type ResetPinInput = z.infer<typeof resetPinInputSchema>

/**
 * children.resetPin — the parent-side recovery for a child who has forgotten
 * their PIN (and possibly their password). The parent never chooses the new
 * PIN: the reset clears `pinHash` and revives the first-login convention
 * (password = username, `mustChangePassword` set), so the child proves
 * themselves with their username and picks a fresh password + PIN through the
 * existing forced-change flow. Any pin_fail lockout earned on the forgotten
 * PIN is cleared so the reset child isn't still locked out.
 */
export class ResetPinHandler extends Handler<ResetPinInput, ChildSummary, SproutStore> {
  private readonly hasher: PasswordHasher

  constructor(hasher: PasswordHasher) {
    super()
    this.hasher = hasher
  }

  async run(input: ResetPinInput, ctx: AppContext<SproutStore>): Promise<ChildSummary> {
    const { child } = await verifyChildOwnership(ctx, input.childId)

    const updated = await ctx.store.updateChild(child.id, {
      pinHash: null,
      passwordHash: this.hasher.hash(child.username),
      mustChangePassword: true,
    })
    if (!updated) throw new NotFoundError('child not found')

    await clearPinFailures(ctx.store, { childId: child.id })

    return {
      id: updated.id,
      displayName: updated.displayName,
      username: updated.username,
      presetName: updated.presetName as PresetName,
    }
  }
}
