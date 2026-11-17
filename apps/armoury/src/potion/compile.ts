// Params -> PotionSpec: everything later tickets read, derived from params and
// the tables alone.

import type { Params } from '../engine/schema.ts'
import { BOTTLES, drawnHeightMm, neckLengthMm, type ShapeId } from './bottles.ts'
import { ingredient, type IngredientId, type Trait } from './ingredients.ts'
import { type PotionMix, potionMix } from './mix.ts'
import { type GlassId, isMixed, type LabelId, MAX_POURS, type StopperId } from './potionSchema.ts'
import { pourList } from './pours.ts'

export interface PotionLayer {
  ingredient: IngredientId
  colour: string
  trait: Trait
}

export interface PotionSpec {
  shape: ShapeId
  bodyHeightMm: number
  neckMm: number
  /**
   * Foot to the top of the stopper allowance, which the glass stopper reaches and the cork stops
   * below. The same for every stopper, so framing ignores the stopper.
   */
  heightMm: number
  glass: GlassId
  stopper: StopperId
  label: LabelId
  /** Bottom first. */
  layers: PotionLayer[]
  /** Layers over the most the bottle takes; a mixed potion is full. */
  fill: number
  mixed: boolean
  /** The mix whenever three are in, so the stage can play a first swirl. */
  mix: PotionMix | null
}

export function compilePotion(p: Params): PotionSpec {
  const layers = pourList(p).map((id) => {
    const { colour, trait } = ingredient(id)
    return { ingredient: id, colour, trait }
  })
  const mix = potionMix(p)
  const mixed = mix !== null && isMixed(p)
  const shape = p.shape as ShapeId
  return {
    shape,
    bodyHeightMm: BOTTLES[shape].bodyHeightMm,
    neckMm: neckLengthMm(p),
    heightMm: drawnHeightMm(p),
    glass: p.glass as GlassId,
    stopper: p.stopper as StopperId,
    label: p.label as LabelId,
    layers,
    fill: layers.length / MAX_POURS,
    mixed,
    mix,
  }
}
