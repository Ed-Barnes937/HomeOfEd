import { Handler, NotFoundError, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { PresetName } from '@hoe/sprout-shared'
import type { ChildUpdate, SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import type { ChildSummary } from './listChildrenHandler.ts'
import { presetNameSchema } from './schemas.ts'

export const updateChildInputSchema = z.object({
  childId: z.string().uuid(),
  displayName: z.string().min(1).optional(),
  presetName: presetNameSchema.optional(),
})
export type UpdateChildInput = z.infer<typeof updateChildInputSchema>

/**
 * children.update — edit a child the authenticated parent owns. Only the
 * provided fields change. Credentials are NOT editable here: after creation a
 * parent never chooses a child's PIN or password — recovery goes through
 * children.resetPin (ADR 0037).
 */
export class UpdateChildHandler extends Handler<UpdateChildInput, ChildSummary, SproutStore> {
  async run(input: UpdateChildInput, ctx: AppContext<SproutStore>): Promise<ChildSummary> {
    const { child } = await verifyChildOwnership(ctx, input.childId)

    const patch: ChildUpdate = {}
    if (input.displayName !== undefined) patch.displayName = input.displayName
    if (input.presetName !== undefined) patch.presetName = input.presetName

    if (Object.keys(patch).length === 0) {
      return {
        id: child.id,
        displayName: child.displayName,
        username: child.username,
        presetName: child.presetName as PresetName,
      }
    }

    const updated = await ctx.store.updateChild(child.id, patch)
    if (!updated) throw new NotFoundError('child not found')
    return {
      id: updated.id,
      displayName: updated.displayName,
      username: updated.username,
      presetName: updated.presetName as PresetName,
    }
  }
}
