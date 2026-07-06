import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { PresetName } from '../../domain/presets.ts'
import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import type { ChildSummary } from './listChildrenHandler.ts'

export const getChildInputSchema = z.object({ childId: z.string().uuid() })
export type GetChildInput = z.infer<typeof getChildInputSchema>

/** children.get — one child the authenticated parent owns (403 otherwise). */
export class GetChildHandler extends Handler<GetChildInput, ChildSummary, SproutStore> {
  async run(input: GetChildInput, ctx: AppContext<SproutStore>): Promise<ChildSummary> {
    const { child } = await verifyChildOwnership(ctx, input.childId)
    return {
      id: child.id,
      displayName: child.displayName,
      username: child.username,
      presetName: child.presetName as PresetName,
    }
  }
}
