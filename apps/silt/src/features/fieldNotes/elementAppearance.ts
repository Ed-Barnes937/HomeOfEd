/**
 * How an element is drawn in Field notes: its base colour and the shape its
 * archetype earns it (spec §6 "Element tiles"). Shape carries behaviour, colour
 * carries identity - static square, powder cut corners, liquid diamond, gas
 * hexagon - so a liquid reads as a liquid at 22px, before the name is legible.
 *
 * Read off the same registry the canvas paints from, never `v1Elements`
 * directly: an element's rail swatch, its cells and its Field notes tile are
 * the same colour because they all come from one place (`colours[0]`, the base
 * shade - ADR 0040).
 */
import type { Archetype, ElementRegistry } from '../../sim/index.ts'

/**
 * The four tile shapes, which are exactly the four archetypes. Typed off
 * `Archetype` so a fifth kernel cannot arrive without a shape for it.
 */
export type TileShape = Archetype['kind']

export interface ElementAppearance {
  /** The element's base colour. Only ever drawn for a *discovered* element (spec §7). */
  hex: string
  shape: TileShape
}

/** Name-keyed, because names are the identity the whole feature is keyed by. */
export type ElementAppearances = ReadonlyMap<string, ElementAppearance>

/** The look of every element in `registry`, whether or not it has been discovered. */
export function elementAppearances(registry: ElementRegistry): ElementAppearances {
  return new Map(
    registry
      .all()
      .map((def) => [def.name, { hex: def.colours[0] ?? '#000000', shape: def.archetype.kind }]),
  )
}
