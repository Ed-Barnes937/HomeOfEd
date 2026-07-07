// Shared child-guardrail-config loader (#36). One place resolves a child's
// effective sliders + calibration answers from the Store, used by:
//   - children.config      (parent-scoped, dashboard — getChildConfigHandler)
//   - children.myConfig     (child-scoped, the chat client's session-limit gate)
//   - the chat SSE route    (server-side, by the authenticated childId)
// so the client never authors guardrail config on the chat path.
import type { CalibrationAnswer } from '../../domain/calibration.ts'
import { PRESET_DEFINITIONS, type PresetSliders } from '../../domain/presets.ts'
import type { SproutStore } from '../../store.ts'

export interface ChildConfig {
  sliders: PresetSliders
  calibrationAnswers: CalibrationAnswer[]
}

/**
 * Load `childId`'s effective config. Safe-by-default (6.5.9): a child with no
 * preset row falls back to the STRICTEST preset (early-learner), never the
 * middle one. Callers own the authorization (parent ownership or child self) —
 * this is a pure read keyed by an already-authorised id.
 */
export async function loadChildConfig(store: SproutStore, childId: string): Promise<ChildConfig> {
  const preset = await store.getPresetByChild(childId)
  const answers = await store.listCalibrationAnswers(childId)

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
