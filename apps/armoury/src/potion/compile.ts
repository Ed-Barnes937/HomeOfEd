// Params -> PotionSpec: everything later tickets read, derived from params and
// the tables alone.

import type { Params } from '../engine/schema.ts'
import { type LinearRgb, linearToSrgb, srgbToLinear } from '../items/colour.ts'
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
   * Foot to the top of the stopper allowance, which the glass stopper reaches and the cork and
   * the wax stop below. The same for every stopper, so framing ignores the stopper.
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
  waxColour: string | null
}

const WAX_DARKENING = 0.65
const EMPTY_WAX = '#7a2a24'

const darken = (hex: string) =>
  linearToSrgb(srgbToLinear(hex).map((v) => v * WAX_DARKENING) as LinearRgb)

function waxColourFor(stopper: StopperId, colour: string | undefined): string | null {
  if (stopper !== 'wax') return null
  return colour ? darken(colour) : EMPTY_WAX
}

export function compilePotion(p: Params): PotionSpec {
  const layers = pourList(p).map((id) => {
    const { colour, trait } = ingredient(id)
    return { ingredient: id, colour, trait }
  })
  const mix = potionMix(p)
  const mixed = mix !== null && isMixed(p)
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
    mixed,
    mix,
    waxColour: waxColourFor(stopper, mixed ? mix.colour : layers.at(-1)?.colour),
  }
}
