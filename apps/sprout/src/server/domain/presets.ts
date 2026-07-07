// The server-side slider-key allow-list for preset updates — sprout-only (the
// pipeline never needs it), so it stays app-local per the P6 extraction
// (plan §5.6). Everything else that used to live here (PRESET_DEFINITIONS,
// PRESET_LIST, SLIDER_LABELS, PresetName, PresetSliders, PresetDefinition) has
// moved to `@hoe/sprout-shared` — import from there instead.

import type { PresetSliders } from '@hoe/sprout-shared'

/** The seven slider keys — the server-side allow-list for preset updates. */
export const SLIDER_KEYS: readonly (keyof PresetSliders)[] = [
  'vocabularyLevel',
  'responseDepth',
  'answeringStyle',
  'interactionMode',
  'topicAccess',
  'sessionLimits',
  'parentVisibility',
]
