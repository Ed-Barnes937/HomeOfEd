// Preset definitions + slider model. Ported from the source
// `packages/shared/src/{types/preset.ts,presets.ts}` (plan §5.6 / §13) — the
// cross-cutting subset consumed by BOTH apps/sprout and apps/sprout-pipeline.

import type { PresetName, Preset } from './types/preset.ts'

export type { Preset, PresetName } from './types/preset.ts'

/**
 * Slider values range from 1-5:
 *   1 = most restricted / simplest / most protective
 *   5 = most open / richest / most independent
 */
export type PresetSliders = Omit<Preset, 'id' | 'childId' | 'name'>

export interface PresetDefinition {
  name: PresetName
  label: string
  description: string
  sliders: PresetSliders
}

export const PRESET_DEFINITIONS: Record<PresetName, PresetDefinition> = {
  'early-learner': {
    name: 'early-learner',
    label: 'Early learner',
    description:
      'Simple vocabulary, short answers, structured interactions. Gentle and encouraging.',
    sliders: {
      vocabularyLevel: 1,
      responseDepth: 1,
      answeringStyle: 1,
      interactionMode: 1,
      topicAccess: 1,
      sessionLimits: 1,
      parentVisibility: 5,
    },
  },
  'confident-reader': {
    name: 'confident-reader',
    label: 'Confident reader',
    description: 'Broader vocabulary, more detailed answers, can ask follow-up questions freely.',
    sliders: {
      vocabularyLevel: 3,
      responseDepth: 3,
      answeringStyle: 3,
      interactionMode: 3,
      topicAccess: 3,
      sessionLimits: 3,
      parentVisibility: 3,
    },
  },
  'independent-explorer': {
    name: 'independent-explorer',
    label: 'Independent explorer',
    description:
      'Full vocabulary, in-depth explanations, freeform conversations with lighter guardrails.',
    sliders: {
      vocabularyLevel: 5,
      responseDepth: 5,
      answeringStyle: 5,
      interactionMode: 5,
      topicAccess: 4,
      sessionLimits: 4,
      parentVisibility: 2,
    },
  },
}

export const SLIDER_LABELS: Record<
  keyof PresetSliders,
  { label: string; low: string; high: string }
> = {
  vocabularyLevel: { label: 'Vocabulary level', low: 'Simple', high: 'Rich' },
  responseDepth: {
    label: 'Response depth',
    low: 'Short & concrete',
    high: 'Detailed & nuanced',
  },
  answeringStyle: {
    label: 'Answering style',
    low: 'Socratic (guides with questions)',
    high: 'Direct (gives answers)',
  },
  interactionMode: {
    label: 'Interaction mode',
    low: 'Structured prompts',
    high: 'Freeform text',
  },
  topicAccess: { label: 'Topic access', low: 'Restricted', high: 'Open' },
  sessionLimits: {
    label: 'Session limits',
    low: 'Short / few messages',
    high: 'Long / unlimited',
  },
  parentVisibility: {
    label: 'Parent visibility',
    low: 'Summaries & flags only',
    high: 'Full conversation review',
  },
}

export const PRESET_LIST: PresetDefinition[] = [
  PRESET_DEFINITIONS['early-learner'],
  PRESET_DEFINITIONS['confident-reader'],
  PRESET_DEFINITIONS['independent-explorer'],
]
