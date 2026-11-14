import type { Params } from '../engine/schema.ts'
import { type EffectKind, ingredient } from './ingredients.ts'
import { potionMix } from './mix.ts'
import { isMixed } from './potionSchema.ts'
import { pourList } from './pours.ts'

export interface PotionEffect {
  kind: EffectKind | 'murky'
  strength: 1 | 2 | 3
  /** The mixed colour, then the colours of the ingredients that carry the effect, in pour order. */
  colours: string[]
}

export const EFFECTS: Record<EffectKind | 'murky', { word: string; sentence: string }> = {
  floating: { word: 'Floating', sentence: 'Pull the cork and bubbles float up to the ceiling.' },
  sparkling: { word: 'Sparkling', sentence: 'Pull the cork and it fizzes with glitter.' },
  dreamy: { word: 'Dreamy', sentence: 'Pull the cork and sleepy stars drift out.' },
  glowing: { word: 'Glowing', sentence: 'Pull the cork and little lights come out to play.' },
  whirling: { word: 'Whirling', sentence: 'Pull the cork and a whirl of colour spins out.' },
  whiffy: { word: 'Whiffy', sentence: 'Pull the cork and out comes a very small pong.' },
  murky: { word: 'Murky', sentence: 'Pull the cork and one lazy bubble goes blorp.' },
}

/** What the mixed potion does, or null while it is not mixed. */
export function potionEffect(p: Params): PotionEffect | null {
  const mix = potionMix(p)
  if (!mix || !isMixed(p)) return null
  const carrying = pourList(p)
    .map(ingredient)
    .filter((i) => i.effect === mix.outcome)
    .map((i) => i.colour)
  return {
    kind: mix.outcome,
    strength: mix.strength,
    colours: [mix.colour, ...new Set(carrying)],
  }
}
