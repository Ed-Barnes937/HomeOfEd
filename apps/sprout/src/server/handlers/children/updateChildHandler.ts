import { Handler, NotFoundError, ValidationError, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { PresetName } from '../../domain/presets.ts'
import type { PasswordHasher } from '../../password.ts'
import type { ChildUpdate, SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import type { ChildSummary } from './listChildrenHandler.ts'
import { presetNameSchema } from './schemas.ts'

export const updateChildInputSchema = z.object({
  childId: z.string().uuid(),
  displayName: z.string().min(1).optional(),
  presetName: presetNameSchema.optional(),
  pin: z.string().optional(),
})
export type UpdateChildInput = z.infer<typeof updateChildInputSchema>

const isValidPin = (pin: string): boolean => /^\d{4}$/.test(pin)

/**
 * children.update — edit a child the authenticated parent owns. Only the
 * provided fields change; a PIN, if given, is validated then hashed here (never
 * stored plaintext, never derived from a client-sent hash).
 */
export class UpdateChildHandler extends Handler<UpdateChildInput, ChildSummary, SproutStore> {
  private readonly hasher: PasswordHasher

  constructor(hasher: PasswordHasher) {
    super()
    this.hasher = hasher
  }

  async run(input: UpdateChildInput, ctx: AppContext<SproutStore>): Promise<ChildSummary> {
    const { child } = await verifyChildOwnership(ctx, input.childId)

    if (input.pin !== undefined && !isValidPin(input.pin)) {
      throw new ValidationError('PIN must be exactly 4 digits.')
    }

    const patch: ChildUpdate = {}
    if (input.displayName !== undefined) patch.displayName = input.displayName
    if (input.presetName !== undefined) patch.presetName = input.presetName
    if (input.pin !== undefined) patch.pinHash = this.hasher.hash(input.pin)

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
