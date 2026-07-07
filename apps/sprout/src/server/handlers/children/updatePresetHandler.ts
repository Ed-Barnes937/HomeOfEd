import { Handler, NotFoundError, type AppContext } from '@hoe/backend-kit'
import type { PresetSliders } from '@hoe/sprout-shared'
import { z } from 'zod'

import type { PresetSliderPatch, SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import { slidersSchema } from './schemas.ts'

export const updatePresetInputSchema = z.object({
  childId: z.string().uuid(),
  sliders: slidersSchema.partial(),
})
export type UpdatePresetInput = z.infer<typeof updatePresetInputSchema>

export interface UpdatePresetResult {
  sliders: PresetSliders
}

/**
 * children.preset — a parent adjusts the guardrail sliders for a child they
 * own. The slider keys are constrained by `slidersSchema` (the server-side
 * allow-list), so no unknown column can be written. Distinct from #36: that
 * concerns the CHAT client authoring sliders; here the PARENT authors them.
 */
export class UpdatePresetHandler extends Handler<
  UpdatePresetInput,
  UpdatePresetResult,
  SproutStore
> {
  async run(input: UpdatePresetInput, ctx: AppContext<SproutStore>): Promise<UpdatePresetResult> {
    const { child } = await verifyChildOwnership(ctx, input.childId)

    const patch: PresetSliderPatch = input.sliders
    const preset = await ctx.store.updatePreset(child.id, patch)
    if (!preset) throw new NotFoundError('preset not found')

    return {
      sliders: {
        vocabularyLevel: preset.vocabularyLevel,
        responseDepth: preset.responseDepth,
        answeringStyle: preset.answeringStyle,
        interactionMode: preset.interactionMode,
        topicAccess: preset.topicAccess,
        sessionLimits: preset.sessionLimits,
        parentVisibility: preset.parentVisibility,
      },
    }
  }
}
