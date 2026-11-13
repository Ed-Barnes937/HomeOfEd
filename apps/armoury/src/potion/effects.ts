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

/** The commonest key, a tie going to the last one: pour lists run bottom first, so that is the pour nearest the cork. */
export function commonestFromTop<K>(keys: readonly K[]): K {
  const count = (key: K) => keys.filter((k) => k === key).length
  let best = keys[keys.length - 1]!
  for (let i = keys.length - 1; i >= 0; i--) if (count(keys[i]!) > count(best)) best = keys[i]!
  return best
}

/** The commonest effect among the pours, a tie going to the pour nearest the cork. */
export function potionEffect(p: Params): PotionEffect | null {
  const pours = pourList(p).map(ingredient)
  if (pours.length === 0) return null
  const kind = commonestFromTop(pours.map((i) => i.effect))
  const carrying = pours.filter((i) => i.effect === kind).reverse()
  return {
    kind,
    strength: carrying.length as PotionEffect['strength'],
    colours: carrying.map((i) => i.colour),
  }
}
