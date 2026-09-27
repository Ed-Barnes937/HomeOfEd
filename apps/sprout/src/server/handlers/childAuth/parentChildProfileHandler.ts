import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { PresetName } from '@hoe/sprout-shared'
import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import type { DeviceChildSummary } from './deviceChildrenHandler.ts'

export const parentChildProfileInputSchema = z.object({
  childId: z.string().uuid(),
})
export type ParentChildProfileInput = z.infer<typeof parentChildProfileInputSchema>

/**
 * childAuth.parentChildProfile — the child-login screen's view of one child
 * when a signed-in parent hands the device over (dashboard "Log in as"). The
 * same shape the device picker returns, so the PIN screen needs no new state;
 * parent-scoped, so it only resolves for the parent's own child.
 */
export class ParentChildProfileHandler extends Handler<
  ParentChildProfileInput,
  DeviceChildSummary,
  SproutStore
> {
  async run(
    input: ParentChildProfileInput,
    ctx: AppContext<SproutStore>,
  ): Promise<DeviceChildSummary> {
    const { child } = await verifyChildOwnership(ctx, input.childId)
    return {
      id: child.id,
      displayName: child.displayName,
      presetName: child.presetName as PresetName,
      hasPin: child.pinHash !== null,
    }
  }
}
