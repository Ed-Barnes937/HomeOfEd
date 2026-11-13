import type { Params } from '../engine/schema.ts'
import { type EffectKind, ingredient } from './ingredients.ts'
import { pourList } from './pours.ts'

export interface PotionEffect {
  kind: EffectKind
  strength: 1 | 2 | 3 | 4
  /** The colours of the pours that carry the effect, top first. */
  colours: string[]
}

export const EFFECTS: Record<EffectKind, { word: string; sentence: string }> = {
  floating: { word: 'Floating', sentence: 'Pull the cork and bubbles float up to the ceiling.' },
  sparkling: { word: 'Sparkling', sentence: 'Pull the cork and it fizzes with glitter.' },
  dreamy: { word: 'Dreamy', sentence: 'Pull the cork and sleepy stars drift out.' },
  glowing: { word: 'Glowing', sentence: 'Pull the cork and little lights come out to play.' },
  whirling: { word: 'Whirling', sentence: 'Pull the cork and a whirl of colour spins out.' },
  whiffy: { word: 'Whiffy', sentence: 'Pull the cork and out comes a very small pong.' },
}

/** The commonest effect among the pours, a tie going to the pour nearest the cork. */
export function potionEffect(p: Params): PotionEffect | null {
  const pours = pourList(p).map(ingredient)
  if (pours.length === 0) return null
  const count = (kind: EffectKind) => pours.filter((i) => i.effect === kind).length
  let kind = pours[pours.length - 1]!.effect
  for (let i = pours.length - 1; i >= 0; i--) {
    const candidate = pours[i]!.effect
    if (count(candidate) > count(kind)) kind = candidate
  }
  const carrying = pours.filter((i) => i.effect === kind).reverse()
  return {
    kind,
    strength: carrying.length as PotionEffect['strength'],
    colours: carrying.map((i) => i.colour),
  }
}
