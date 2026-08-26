// Shared child-guardrail-config loader (#36). One place resolves a child's
// effective sliders + calibration answers from the Store, used by:
//   - children.config      (parent-scoped, dashboard — getChildConfigHandler)
//   - children.myConfig     (child-scoped, the chat client's session-limit gate)
//   - the chat SSE route    (server-side, by the authenticated childId)
// so the client never authors guardrail config on the chat path.
import {
  PRESET_DEFINITIONS,
  type CalibrationAnswer,
  type PresetName,
  type PresetSliders,
} from '@hoe/sprout-shared'

import type { SproutStore } from '../../store.ts'

export interface ChildConfig {
  presetName: PresetName
  sliders: PresetSliders
  calibrationAnswers: CalibrationAnswer[]
}

/**
 * Load `childId`'s effective config. Safe-by-default (6.5.9): a child with no
 * preset row falls back to the STRICTEST preset (early-learner), never the
 * middle one — the same fallback covers `presetName`, which selects the
 * child-facing disclosure register (ADR-0017). Callers own the authorization
 * (parent ownership or child self) — this is a pure read keyed by an
 * already-authorised id.
 */
export async function loadChildConfig(store: SproutStore, childId: string): Promise<ChildConfig> {
  const preset = await store.getPresetByChild(childId)
  const answers = await store.listCalibrationAnswers(childId)

  // The row's `name` column is plain text; only a known preset name may pick a
  // less-strict disclosure register.
  const presetName: PresetName =
    preset && preset.name in PRESET_DEFINITIONS ? (preset.name as PresetName) : 'early-learner'

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
    presetName,
    sliders,
    calibrationAnswers: answers.map((a) => ({
      questionId: a.questionId,
      selectedLevel: a.selectedLevel,
      customAnswer: a.customAnswer,
    })),
  }
}
