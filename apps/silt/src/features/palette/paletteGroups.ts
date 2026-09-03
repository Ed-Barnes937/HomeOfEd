import {
  ACID,
  DIRT,
  FIRE,
  LAVA,
  OIL,
  SAND,
  SEED,
  STONE,
  WATER,
  WOOD,
  type ElementRegistry,
} from '../../sim/index.ts'

/**
 * The **base** paintable roster (spec §4) — everything in `v1Elements` except
 * the reaction products, which must never appear in the palette: obsidian, and
 * now smoke, steam and sulphur — sulphur is what corroding wood leaves behind,
 * and painting it directly would make acid a second eraser rather than a tool.
 * Moss and vine are products too, and deliberately so: they are what a seed
 * planted in wet soil earns you. So are ember and ash - a cell of wood that
 * something set smoldering, and what the fire left of it, never something you
 * place. And so, since the discovery tree, is **mud**: it is dirt + water's
 * product, and the one element the player earns back into the rail by mastering
 * it (discovery-tree spec §9.5-9.6).
 *
 * **Nothing else leaves this list, however product-like it looks.** Stone, dirt
 * and fire are core tools whose product status is incidental, and wood is a
 * trap: its only recipe is dousing an ember, and an ember only exists where
 * fire found wood. Trim wood and the whole char chain (wood -> ember -> ash ->
 * mud) becomes unreachable from a fresh rail.
 *
 * Listed explicitly, rather than derived by excluding a tag,
 * so a future reaction product doesn't have to remember to also carry an
 * "un-paintable" marker to stay out of the rail.
 *
 * Order is rail order, and rail order is the `1`–`9` hotkey order — new
 * elements go on the end, so an existing element never changes its digit.
 *
 * **The digits ran out at nine** (materials spec §8). Seed is the tenth entry,
 * so it has no hotkey. That is an open UI decision, not an oversight: `0` for
 * the tenth strands an eleventh, and anything better is a change to the shortcut
 * scheme rather than to an element. Appending here is what keeps every existing
 * digit where it was - as does keeping earned unlocks out of this list entirely
 * (spec §9.8).
 */
export const PAINTABLE_IDS: readonly number[] = [
  DIRT,
  SAND,
  WATER,
  LAVA,
  WOOD,
  OIL,
  FIRE,
  ACID,
  STONE,
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
  /** The base rail, in `PAINTABLE_IDS` order - which is the `1`-`9` hotkey order. */
  entries: readonly PaletteEntry[]
  groups: readonly PaletteGroup[]
  /**
   * Elements earned by mastering them, in the order they were passed in. They
   * live in the rail's EARNED control rather than in `entries`/`groups`, so the
   * rail's length and every hotkey stay put however many unlocks arrive
   * (discovery-tree spec §9.8).
   */
  earned: readonly PaletteEntry[]
  /** Element colours and names are identical in the rail and the grid (spec
   * §9) — this is what makes that true: both read off the same registry the
   * renderer paints from (../render/speciesPalette.ts), never `v1Elements`
   * directly (ticket 16). Earned elements are looked up here too: an unlock is
   * fully paintable, so the status bar and the cursor must be able to name it. */
  colourOf(id: number): string | undefined
  nameOf(id: number): string
}

function entryOf(registry: ElementRegistry, id: number): PaletteEntry {
  const def = registry.get(id)
  if (!def) throw new Error(`palette: no element definition for id ${id}`)
  return { id: def.id, name: def.name, colour: def.colours[0] ?? '#000000', tags: def.tags }
}

/**
 * Builds the rail's view of the roster off `registry` — pass the sim's own
 * `registry`, the same one handed to `buildSpeciesPalette`, so a non-default
 * roster can't render one set of colours on the canvas and another in the rail.
 *
 * `unlocked` is field notes' earned list (`useFieldNotes().unlocked`), by name:
 * names are the identity the whole discovery feature is keyed by, and a name
 * this roster no longer knows is simply not earned rather than an error - the
 * same forward-compatibility the stored edge keys get.
 */
export function buildRailPalette(
  registry: ElementRegistry,
  unlocked: readonly string[] = [],
): RailPalette {
  const entries: readonly PaletteEntry[] = PAINTABLE_IDS.map((id) => entryOf(registry, id))

  const byName = new Map(registry.all().map((def) => [def.name, def]))
  const earned: readonly PaletteEntry[] = unlocked.flatMap((name) => {
    const def = byName.get(name)
    return def ? [entryOf(registry, def.id)] : []
  })

  const groups: readonly PaletteGroup[] = GROUP_ORDER.map(({ tag, label }) => ({
    label,
    entries: entries.filter((entry) => entry.tags.includes(tag)),
  })).filter((group) => group.entries.length > 0)

  const find = (id: number): PaletteEntry | undefined =>
    entries.find((entry) => entry.id === id) ?? earned.find((entry) => entry.id === id)

  return {
    entries,
    groups,
    earned,
    colourOf: (id) => find(id)?.colour,
    nameOf: (id) => find(id)?.name ?? '',
  }
}

/** Round brush diameters in cells (spec §9's "four squares at true relative
 * scale", drawn as circles since the brush went round). */
export const BRUSH_WIDTHS: readonly number[] = [1, 3, 5, 7]
