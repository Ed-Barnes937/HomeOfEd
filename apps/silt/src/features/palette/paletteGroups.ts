import { DIRT, LAVA, SAND, WATER, v1Elements } from '../../sim/index.ts'

/**
 * The v1 paintable roster (spec §4) — everything in `v1Elements` except
 * Obsidian, which is a reaction product and must never appear in the palette.
 * Listed explicitly, rather than derived by excluding a tag, so a future
 * reaction product doesn't have to remember to also carry an "un-paintable"
 * marker to stay out of the rail.
 */
const PAINTABLE_IDS: readonly number[] = [DIRT, SAND, WATER, LAVA]

export interface PaletteEntry {
  id: number
  name: string
  colour: string
  tags: readonly string[]
}

/** Colours and names read straight off the registry config — never hardcoded here. */
export const paletteEntries: readonly PaletteEntry[] = PAINTABLE_IDS.map((id) => {
  const def = v1Elements.find((element) => element.id === id)
  if (!def) throw new Error(`palette: no element definition for id ${id}`)
  return { id: def.id, name: def.name, colour: def.colours[0] ?? '#000000', tags: def.tags }
})

/**
 * Group labels in display order (spec §9). A group with no members is left
 * out entirely — Energy has no v1 elements, and an empty section would just
 * be dead chrome with nothing to distinguish it from a labelling mistake.
 * The roster is built to triple (spec §9), so this stays generic rather than
 * special-casing today's four elements.
 */
const GROUP_ORDER: readonly { tag: string; label: string }[] = [
  { tag: 'solid', label: 'Solid' },
  { tag: 'powder', label: 'Powder' },
  { tag: 'liquid', label: 'Liquid' },
  { tag: 'energy', label: 'Energy' },
]

export interface PaletteGroup {
  label: string
  entries: readonly PaletteEntry[]
}

export const paletteGroups: readonly PaletteGroup[] = GROUP_ORDER.map(({ tag, label }) => ({
  label,
  entries: paletteEntries.filter((entry) => entry.tags.includes(tag)),
})).filter((group) => group.entries.length > 0)

/** Square brush widths in cells (spec §9 "four squares at true relative scale"). */
export const BRUSH_WIDTHS: readonly number[] = [1, 3, 5, 7]
