// Child-facing honest-disclosure copy (ADR-0017). Counsel-reviewable — do NOT
// reword. One voice, three reading levels; the register is selected by the
// child's preset from the server-side `children.myConfig` read.
import type { PresetName } from '@hoe/sprout-shared'

/** The statement card's title (all presets). */
export const DISCLOSURE_CARD_TITLE = "I'm Sprout!"

/** The persistent one-line disclosure above the chat input (chrome voice). */
export const DISCLOSURE_LINE: Record<PresetName, string> = {
  'early-learner': 'Sprout is a computer, not a person. Your grown-up can see your chats.',
  'confident-reader':
    'Sprout is a computer program, not a person. Your parent can see your chats.',
  'independent-explorer':
    'Sprout is an AI — a computer program, not a human. Your parent can see your conversations.',
}

/** The first-run statement card lines (AI voice). */
export const DISCLOSURE_CARD_LINES: Record<PresetName, string[]> = {
  'early-learner': [
    "I'm a computer, not a person.",
    'I can help you learn things.',
    'Sometimes I get things wrong. A grown-up can help you check.',
    'Your grown-up can see what we talk about.',
  ],
  'confident-reader': [
    "I'm a computer program, not a real person.",
    'I can help you learn and explore.',
    "Sometimes I get things wrong — it's worth checking with a grown-up.",
    'Your parent can see what we talk about.',
  ],
  'independent-explorer': [
    "I'm an AI — a computer program, not a human.",
    'I can help you learn, explore, and think things through.',
    'I can be wrong, so check important things with a person you trust.',
    'Your parent can see our conversations.',
  ],
}
