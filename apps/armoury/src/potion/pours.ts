// Pour helpers the item and the picker share: ingredients are three ordered slots,
// bottom first, with no gaps.

import type { ParamValue, Params } from '../engine/schema.ts'
import { type IngredientId, isIngredient } from './ingredients.ts'
import { isPourKey, POUR_KEYS, type PourKey } from './potionSchema.ts'

export type PourSlots = Record<PourKey, string>

/** The ingredients bottom first, without the empty slots. */
export function pourList(p: Params): IngredientId[] {
  return POUR_KEYS.map((k) => p[k]).filter(isIngredient)
}

/** The three slots for a list of ingredients, `none` above. */
export function withPours(list: readonly IngredientId[]): PourSlots {
  return Object.fromEntries(POUR_KEYS.map((k, i) => [k, list[i] ?? 'none'])) as PourSlots
}

/** The lowest empty slot, or null when the bottle is full. */
export function nextPourKey(p: Params): PourKey | null {
  return POUR_KEYS[pourList(p).length] ?? null
}

/** The slots a pour into an empty slot lands in, or undefined when a plain set is enough. */
export function followPours(before: Params, key: string, value: ParamValue): PourSlots | undefined {
  if (!isPourKey(key) || !isIngredient(value)) return undefined
  const list = pourList(before)
  if (POUR_KEYS.indexOf(key) < list.length) return undefined
  const result = withPours([...list, value])
  return result[key] === value ? undefined : result
}
