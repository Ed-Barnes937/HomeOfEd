import type { ElementDef, ReactionRow } from './types.ts'

/**
 * **Pinned species ids** — these bytes land in localStorage scenes, so they are
 * never renumbered.
 */
export const EMPTY = 0
export const DIRT = 1
export const SAND = 2
export const WATER = 3
export const LAVA = 4
export const OBSIDIAN = 5

/**
 * Out-of-bounds sentinel. Reads past the edge return this, so no element ever
 * branches on edges — the world behaves as if walled.
 */
export const WALL = 255

const dirt: ElementDef = {
  id: DIRT,
  name: 'dirt',
  colours: ['#8a7358'],
  tags: ['solid'],
  archetype: { kind: 'static' },
}

const sand: ElementDef = {
  id: SAND,
  name: 'sand',
  colours: ['#d9b978'],
  tags: ['powder'],
  // slide 1 = always tries a diagonal when blocked below, the classic
  // falling-sand angle of repose. Density 60 is the top of the roster, so a
  // grain sinks through both liquids.
  archetype: { kind: 'powder', density: 60, slide: 1 },
}

const water: ElementDef = {
  id: WATER,
  name: 'water',
  colours: ['#6f9fc4'],
  tags: ['liquid'],
  // Five cells of sideways travel a tick is what makes a poured column read as
  // spreading rather than as a wobbling stack.
  archetype: { kind: 'liquid', density: 30, dispersion: 5 },
}

const lava: ElementDef = {
  id: LAVA,
  name: 'lava',
  colours: ['#d4622a'],
  tags: ['liquid', 'hot'],
  // The "slow liquid" (spec §4): it acts on roughly one tick in seven, and
  // spreads two cells rather than five when it does, so it oozes.
  archetype: { kind: 'liquid', density: 45, dispersion: 2, move: 0.15 },
}

const obsidian: ElementDef = {
  id: OBSIDIAN,
  name: 'obsidian',
  // Not in the design brief's swatch list — the brief only names the paintable
  // elements, and obsidian is a reaction product. Chosen to sit between the
  // world's near-black and the cooled-rock purple the lava suggests.
  colours: ['#2a2430'],
  tags: ['solid'],
  archetype: { kind: 'static' },
}

/** The v1 roster (spec §4). Pure config — zero behavioural code. */
export const v1Elements: readonly ElementDef[] = [dirt, sand, water, lava, obsidian]

/**
 * The whole of v1's chemistry (spec §4): where water touches lava, both cells
 * freeze into obsidian. It is a row of data, not a hook — the elements above
 * name neither each other nor the product.
 */
export const v1Reactions: readonly ReactionRow[] = [
  { a: 'water', b: 'lava', p: 1, aBecomes: 'obsidian', bBecomes: 'obsidian' },
]
