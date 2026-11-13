// Pour helpers the item and the picker share: pours are four ordered slots,
// bottom first, with no gaps.

import type { Params } from '../engine/schema.ts'
import { INGREDIENTS, type IngredientId } from './ingredients.ts'
import { MAX_POURS, POUR_KEYS, type PourKey } from './potionSchema.ts'

export type PourSlots = Record<PourKey, string>

const isIngredient = (v: unknown): v is IngredientId => INGREDIENTS.some((i) => i.id === v)

/** The pours bottom first, without the empty slots. */
export function pourList(p: Params): IngredientId[] {
  return POUR_KEYS.map((k) => p[k]).filter(isIngredient)
}

/** The four slots for a list of pours, `none` above. */
export function withPours(list: readonly IngredientId[]): PourSlots {
  return Object.fromEntries(POUR_KEYS.map((k, i) => [k, list[i] ?? 'none'])) as PourSlots
}

/** The lowest empty slot, or null when the bottle is full. */
export function nextPourKey(p: Params): PourKey | null {
  return POUR_KEYS[pourList(p).length] ?? null
}

/** The pours a `set` of a pour slot brings with it, or undefined when a plain set is enough. */
export function followPours(
  before: Params,
  key: string,
  value: string | number,
): PourSlots | undefined {
  const index = POUR_KEYS.indexOf(key as PourKey)
  if (index < 0) return undefined
  const list = pourList(before)
  let after: IngredientId[]
  if (value === 'none') after = list.filter((_, i) => i !== index)
  else if (isIngredient(value))
    after = index < list.length ? list.map((id, i) => (i === index ? value : id)) : [...list, value]
  else return undefined
  const result = withPours(after.slice(0, MAX_POURS))
  const plain = { ...before, [key]: value }
  return POUR_KEYS.every((k) => result[k] === plain[k]) ? undefined : result
}
