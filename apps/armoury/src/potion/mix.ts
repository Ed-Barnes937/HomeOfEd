// The mixing rule: three ingredients on a colour wheel add up to one effect, or to mud.

import type { Params } from '../engine/schema.ts'
import { type EffectKind, ingredient, type IngredientId, type Trait } from './ingredients.ts'
import { effectColour, murkyColour } from './mixColour.ts'
import { pourList } from './pours.ts'
import { MURK_REACH, WHEEL_STEP_DEGREES } from './wheel.ts'

export { MURK_REACH, WHEEL_STEP_DEGREES }

export const SECTOR_START_DEGREES = -3.25
export const SECTOR_ORDER: readonly EffectKind[] = [
  'glowing',
  'floating',
  'sparkling',
  'whirling',
  'dreamy',
  'whiffy',
]

const TIE_TOLERANCE_DEGREES = 1e-9
const SECTOR_DEGREES = 360 / SECTOR_ORDER.length

export interface PotionMix {
  outcome: EffectKind | 'murky'
  colour: string
  trait: Trait
  main: IngredientId | null
  strength: 1 | 2 | 3
  /** Degrees round the wheel the three ingredients' sum points at. */
  angle: number
  /** The length of that sum, 0-3. */
  reach: number
}

export type Recipe = readonly [IngredientId, IngredientId, IngredientId]

const radians = (degrees: number) => (degrees * Math.PI) / 180
const turn = (degrees: number) => ((degrees % 360) + 360) % 360
const wheelAngle = (id: IngredientId) => ingredient(id).wheel * WHEEL_STEP_DEGREES
const apart = (a: number, b: number) => {
  const gap = turn(a - b)
  return Math.min(gap, 360 - gap)
}

/** The most repeated carrier of the outcome, a tie going to the nearest the sum, an exact tie to the lower wheel place; a surprise has none, so the nearest of the three. */
function mainFor(outcome: EffectKind, ids: readonly IngredientId[], angle: number): IngredientId {
  const carriers = ids.filter((id) => ingredient(id).effect === outcome)
  const pool = carriers.length > 0 ? carriers : ids
  const repeats = (id: IngredientId) => carriers.filter((c) => c === id).length
  const most = Math.max(...pool.map(repeats))
  const nearer = (a: IngredientId, b: IngredientId) =>
    apart(wheelAngle(a), angle) < apart(wheelAngle(b), angle) - TIE_TOLERANCE_DEGREES
  return pool
    .filter((id) => repeats(id) === most)
    .reduce((best, id) => (nearer(id, best) ? id : best))
}

export function mixPotion(ids: Recipe): PotionMix {
  const sorted = [...ids].sort((a, b) => ingredient(a).wheel - ingredient(b).wheel)
  let x = 0
  let y = 0
  for (const id of sorted) {
    x += Math.cos(radians(wheelAngle(id)))
    y += Math.sin(radians(wheelAngle(id)))
  }
  const reach = Math.hypot(x, y)
  const angle = turn((Math.atan2(y, x) * 180) / Math.PI)
  if (reach < MURK_REACH) {
    const colour = murkyColour(sorted.map((id) => ingredient(id).colour))
    return { outcome: 'murky', colour, trait: 'murk', main: null, strength: 1, angle, reach }
  }
  const outcome = SECTOR_ORDER[Math.floor(turn(angle - SECTOR_START_DEGREES) / SECTOR_DEGREES)]!
  const main = mainFor(outcome, sorted, angle)
  const carrying = sorted.filter((id) => ingredient(id).effect === outcome).length
  return {
    outcome,
    colour: effectColour(angle, reach),
    trait: ingredient(main).trait,
    main,
    strength: Math.max(1, carrying) as PotionMix['strength'],
    angle,
    reach,
  }
}

/** The mix of the three slots whenever all three are filled, mixed or not. */
export function potionMix(p: Params): PotionMix | null {
  const pours = pourList(p)
  return pours.length === 3 ? mixPotion(pours as unknown as Recipe) : null
}
