// Chat UI constants: inspire-me topics, intent categories, session-limit map.
// Ported verbatim (behaviour) from the source `lib/chat-config.ts`.
import type { PresetSliders } from '../server/domain/presets.ts'

const INSPIRE_ME_TOPICS = [
  'How do volcanoes work?',
  'What are black holes?',
  'How do animals talk to each other?',
  'Why is the sky blue?',
  'How do computers think?',
  'What lives at the bottom of the ocean?',
  'How does the weather work?',
  'Why do we dream?',
  'How do plants grow?',
  'What are dinosaurs?',
  'How does electricity work?',
  'Why do leaves change colour in autumn?',
  'How do aeroplanes fly?',
  'What is DNA?',
  'How do our eyes see things?',
  'What are constellations?',
  'How do bridges stay up?',
  'Why do we have different languages?',
  'How do bees make honey?',
  'What causes earthquakes?',
]

export function getRandomTopic(): string {
  const index = Math.floor(Math.random() * INSPIRE_ME_TOPICS.length)
  return INSPIRE_ME_TOPICS[index] ?? 'Why is the sky blue?'
}

export interface IntentCategory {
  id: string
  label: string
  prompt: string
  emoji: string
}

export const INTENT_CATEGORIES: IntentCategory[] = [
  { id: 'learn', label: 'I want to learn about...', prompt: 'Tell me about ', emoji: '🔍' },
  {
    id: 'homework',
    label: 'Help me with my homework',
    prompt: 'Can you help me with my homework? ',
    emoji: '📚',
  },
  { id: 'story', label: "Let's write a story", prompt: "Let's write a story about ", emoji: '✏️' },
  { id: 'explain', label: 'Explain something to me', prompt: 'Can you explain ', emoji: '💡' },
  { id: 'quiz', label: 'Quiz me on something', prompt: 'Quiz me about ', emoji: '🧠' },
]

export const INSPIRE_SESSION_KEY = 'sprout-inspire'

export const MAX_CONVERSATION_TITLE_LEN = 100

export const RESTRICTED_INTERACTION_THRESHOLD = 3

export type SliderLevel = 1 | 2 | 3 | 4 | 5

export const SESSION_LIMIT_MAP: Record<SliderLevel, number> = {
  1: 10,
  2: 20,
  3: 30,
  4: 50,
  5: Infinity,
}

export function getSessionLimit(sliders: PresetSliders | null): number {
  if (!sliders) return Infinity
  const key = sliders.sessionLimits as SliderLevel
  return SESSION_LIMIT_MAP[key] ?? 10
}
