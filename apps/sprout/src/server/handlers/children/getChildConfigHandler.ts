import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { CalibrationAnswer } from '../../domain/calibration.ts'
import { PRESET_DEFINITIONS, type PresetSliders } from '../../domain/presets.ts'
import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'

export const getChildConfigInputSchema = z.object({ childId: z.string().uuid() })
export type GetChildConfigInput = z.infer<typeof getChildConfigInputSchema>

export interface ChildConfig {
  sliders: PresetSliders
  calibrationAnswers: CalibrationAnswer[]
}

/**
 * children.config — the child's guardrail sliders + calibration answers, for
 * the parent dashboard. Safe-by-default (6.5.9): a child with no preset row
 * falls back to the STRICTEST preset (early-learner), not the middle one.
 *
 * NB the chat SSE path (P5) loads this config by the authenticated child's own
 * id server-side (#36) — a separate code path, not this parent-scoped procedure.
 */
export class GetChildConfigHandler extends Handler<GetChildConfigInput, ChildConfig, SproutStore> {
  async run(input: GetChildConfigInput, ctx: AppContext<SproutStore>): Promise<ChildConfig> {
    const { child } = await verifyChildOwnership(ctx, input.childId)

    const preset = await ctx.store.getPresetByChild(child.id)
    const answers = await ctx.store.listCalibrationAnswers(child.id)

    const sliders: PresetSliders = preset
      ? {
          vocabularyLevel: preset.vocabularyLevel,
          responseDepth: preset.responseDepth,
          answeringStyle: preset.answeringStyle,
          interactionMode: preset.interactionMode,
          topicAccess: preset.topicAccess,
          sessionLimits: preset.sessionLimits,
          parentVisibility: preset.parentVisibility,
        }
      : PRESET_DEFINITIONS['early-learner'].sliders

    return {
      sliders,
      calibrationAnswers: answers.map((a) => ({
        questionId: a.questionId,
        selectedLevel: a.selectedLevel,
        customAnswer: a.customAnswer,
      })),
    }
  }
}
