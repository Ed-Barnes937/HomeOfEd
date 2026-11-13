// Params -> PotionSpec: everything later tickets read, derived from params and
// the tables alone.

import type { Params } from '../engine/schema.ts'
import { type LinearRgb, linearToSrgb, srgbToLinear } from '../items/colour.ts'
import { BOTTLES, drawnHeightMm, neckLengthMm, type ShapeId } from './bottles.ts'
import { ingredient, type IngredientId, type Trait } from './ingredients.ts'
import { type GlassId, type LabelId, MAX_POURS, type StopperId } from './potionSchema.ts'
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
  /** Foot to stopper top. */
  heightMm: number
  glass: GlassId
  stopper: StopperId
  label: LabelId
  /** Bottom first. */
  layers: PotionLayer[]
  /** Pours over the most the bottle takes. */
  fill: number
  waxColour: string | null
}

const WAX_DARKENING = 0.65
const EMPTY_WAX = '#7a2a24'

const darken = (hex: string) =>
  linearToSrgb(srgbToLinear(hex).map((v) => v * WAX_DARKENING) as LinearRgb)

export function compilePotion(p: Params): PotionSpec {
  const layers = pourList(p).map((id) => {
    const { colour, trait } = ingredient(id)
    return { ingredient: id, colour, trait }
  })
  const top = layers.at(-1)
  const stopper = p.stopper as StopperId
  const shape = p.shape as ShapeId
  return {
    shape,
    bodyHeightMm: BOTTLES[shape].bodyHeightMm,
    neckMm: neckLengthMm(p),
    heightMm: drawnHeightMm(p),
    glass: p.glass as GlassId,
    stopper,
    label: p.label as LabelId,
    layers,
    fill: layers.length / MAX_POURS,
    waxColour: stopper !== 'wax' ? null : top ? darken(top.colour) : EMPTY_WAX,
  }
}
