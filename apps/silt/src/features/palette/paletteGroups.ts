import {
  ACID,
  DIRT,
  FIRE,
  LAVA,
  MUD,
  OIL,
  SAND,
  SEED,
  STONE,
  WATER,
  WOOD,
  type ElementRegistry,
} from '../../sim/index.ts'

/**
 * The paintable roster (spec §4) — everything in `v1Elements` except the
 * reaction products, which must never appear in the palette: obsidian, and now
 * smoke, steam and sulphur — sulphur is what corroding wood leaves behind, and
 * painting it directly would make acid a second eraser rather than a tool.
 * Moss and vine are products too, and deliberately so: they are what a seed
 * planted in wet soil earns you.
 * Listed explicitly, rather than derived by excluding a tag,
 * so a future reaction product doesn't have to remember to also carry an
 * "un-paintable" marker to stay out of the rail.
 *
 * Order is rail order, and rail order is the `1`–`9` hotkey order — new
 * elements go on the end, so an existing element never changes its digit.
 *
 * **The digits ran out at nine** (materials spec §8). Mud is the tenth entry
 * and seed the eleventh, so neither has a hotkey. That is an open UI decision,
 * not an oversight: `0` for the tenth strands the eleventh, and anything better
 * is a change to the shortcut scheme rather than to an element. Appending here
 * is what keeps every existing digit where it was.
 */
const PAINTABLE_IDS: readonly number[] = [
  DIRT,
  SAND,
  WATER,
  LAVA,
  WOOD,
  OIL,
  FIRE,
  ACID,
  STONE,
  MUD,
  SEED,
]

export interface PaletteEntry {
  id: number
  name: string
  colour: string
  tags: readonly string[]
}

export interface PaletteGroup {
  label: string
  entries: readonly PaletteEntry[]
}

/**
 * Group labels in display order (spec §9). A group with no members is left
 * out entirely — an empty section would just be dead chrome with nothing to
 * distinguish it from a labelling mistake. Fire is the first `energy` element,
 * so Energy renders for the first time here.
 * The roster is built to triple (spec §9), so this stays generic rather than
 * special-casing today's four elements.
 */
const GROUP_ORDER: readonly { tag: string; label: string }[] = [
  { tag: 'solid', label: 'Solid' },
  { tag: 'powder', label: 'Powder' },
  { tag: 'liquid', label: 'Liquid' },
  { tag: 'energy', label: 'Energy' },
]

export interface RailPalette {
  entries: readonly PaletteEntry[]
  groups: readonly PaletteGroup[]
  /** Element colours and names are identical in the rail and the grid (spec
   * §9) — this is what makes that true: both read off the same registry the
   * renderer paints from (../render/speciesPalette.ts), never `v1Elements`
   * directly (ticket 16). */
  colourOf(id: number): string | undefined
  nameOf(id: number): string
}

/** Builds the rail's view of the roster off `registry` — pass the sim's own
 * `registry`, the same one handed to `buildSpeciesPalette`, so a non-default
 * roster can't render one set of colours on the canvas and another in the rail. */
export function buildRailPalette(registry: ElementRegistry): RailPalette {
  const entries: readonly PaletteEntry[] = PAINTABLE_IDS.map((id) => {
    const def = registry.get(id)
    if (!def) throw new Error(`palette: no element definition for id ${id}`)
    return { id: def.id, name: def.name, colour: def.colours[0] ?? '#000000', tags: def.tags }
  })

  const groups: readonly PaletteGroup[] = GROUP_ORDER.map(({ tag, label }) => ({
    label,
    entries: entries.filter((entry) => entry.tags.includes(tag)),
  })).filter((group) => group.entries.length > 0)

  return {
    entries,
    groups,
    colourOf: (id) => entries.find((entry) => entry.id === id)?.colour,
    nameOf: (id) => entries.find((entry) => entry.id === id)?.name ?? '',
  }
}

/** Square brush widths in cells (spec §9 "four squares at true relative scale"). */
export const BRUSH_WIDTHS: readonly number[] = [1, 3, 5, 7]
