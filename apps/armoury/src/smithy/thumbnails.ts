import { normalise, type Params } from '../engine/schema.ts'
import { compileSword } from '../sword/compile.ts'
import { type Family, signatureFor } from '../sword/families.ts'
import { swordOutline } from '../sword/outline.ts'
import { swordSchema } from '../sword/swordSchema.ts'
import { pathOf, viewBoxFor, type Crop } from './outline.ts'

/** A sword's flat outline, ready for an SVG. */
export interface Drawing {
  viewBox: string
  d: string
}

export function drawOutline(params: Params, crop: Crop): Drawing {
  const spec = compileSword(params)
  const outline = swordOutline(spec)
  return { viewBox: viewBoxFor(spec, outline, crop), d: pathOf(outline) }
}

/** The groups whose params a crop shows, besides the Kind; a Kind tile shows only its Kind. */
const SHOWN: Record<Crop, string[]> = { sword: [], guard: ['guard'], pommel: ['grip', 'pommel'] }
const shownKeys = (crop: Crop) =>
  swordSchema.params.filter((def) => SHOWN[crop].includes(def.group)).map((def) => def.key)

const KEPT = 64

/**
 * A picker's tiles: each is the option drawn on its Kind's signature sword with only the params
 * its crop shows, so it is redrawn only when one of those changes.
 */
export function thumbnails(draw: (params: Params, crop: Crop) => Drawing = drawOutline) {
  const drawn = new Map<string, Drawing>()
  return (crop: Crop, params: Params, key: string, value: string): Drawing => {
    const family = (key === 'family' ? value : params.family) as Family
    const shown = Object.fromEntries(shownKeys(crop).map((k) => [k, params[k]]))
    const id = JSON.stringify([crop, family, shown, key, value])
    let drawing = drawn.get(id)
    if (!drawing) {
      const tile = { ...signatureFor(family), family, ...shown, [key]: value }
      drawing = draw(normalise(swordSchema, tile), crop)
      drawn.set(id, drawing)
      if (drawn.size > KEPT) drawn.delete(drawn.keys().next().value!)
    }
    return drawing
  }
}

export const thumbnail = thumbnails()
