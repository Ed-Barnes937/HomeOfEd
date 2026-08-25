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
export const WOOD = 6
export const OIL = 7
export const FIRE = 8
export const SMOKE = 9
export const STEAM = 10
export const ACID = 11
export const STONE = 12
export const SULPHUR = 13

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
  // The hardness pass (materials spec §3) lands here, where acid first reads
  // it: 0 is "anything dissolves this", and it is also the registry's default.
  hardness: 0,
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
  hardness: 0,
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
  tags: ['liquid'],
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
  // The top of the hardness ladder: nothing in the roster corrodes it, which
  // is what makes it the material to build an acid-proof tank out of.
  hardness: 5,
}

const wood: ElementDef = {
  id: WOOD,
  name: 'wood',
  colours: ['#6b4a2a'],
  tags: ['solid', 'flammable'],
  archetype: { kind: 'static' },
  // Hardness 1 is what later lets acid eat wood while obsidian shrugs it off
  // (materials spec §3); nothing in this group reads it yet.
  hardness: 1,
}

const oil: ElementDef = {
  id: OIL,
  name: 'oil',
  colours: ['#46402c'],
  tags: ['liquid', 'flammable'],
  // Lighter than water (30), so water sinks past it and the oil ends up as the
  // film on top — the displacement rule does this, not a special case.
  archetype: { kind: 'liquid', density: 20, dispersion: 4 },
}

/**
 * The three gases. `canDisplace` is `mine > theirs` and is not direction-aware,
 * so a rising gas only pushes through another gas when it is the *denser* one:
 * the density closest to zero ends up highest. Smoke therefore has to outrank
 * steam, and steam fire, or fire would sit on top of its own smoke.
 */
const fire: ElementDef = {
  id: FIRE,
  name: 'fire',
  colours: ['#ef7d1a'],
  tags: ['gas', 'energy'],
  // `move` is what makes fire linger on its fuel rather than leaving it in one
  // tick; it is a gas, so it does leave eventually.
  archetype: { kind: 'gas', density: -20, dispersion: 1, move: 0.3 },
  // `jitter` is added to `ticks`, never subtracted, so this is 40–60 ticks.
  lifetime: { ticks: 40, jitter: 20, becomes: 'smoke' },
}

const smoke: ElementDef = {
  id: SMOKE,
  name: 'smoke',
  colours: ['#6b6660'],
  tags: ['gas'],
  archetype: { kind: 'gas', density: -5, dispersion: 3 },
  // 200 + 55 is exactly MAX_LIFETIME_TICKS: the countdown lives in one byte,
  // so raising either number without lowering the other is a boot failure.
  lifetime: { ticks: 200, jitter: 55, becomes: null },
}

const steam: ElementDef = {
  id: STEAM,
  name: 'steam',
  colours: ['#cfd6da'],
  tags: ['gas'],
  archetype: { kind: 'gas', density: -10, dispersion: 4 },
  // Condensing back to water is what closes the cycle: water quenches fire,
  // the steam rises, and it rains back down as water.
  lifetime: { ticks: 180, jitter: 60, becomes: 'water' },
}

const acid: ElementDef = {
  id: ACID,
  name: 'acid',
  colours: ['#8fd128'],
  tags: ['liquid'],
  // Denser than water (30), so it sinks under a pool rather than sitting on
  // it, and lighter than sand (60), so a grain still falls through it.
  archetype: { kind: 'liquid', density: 35, dispersion: 4 },
  // Acid is not immune to acid — but rows 6–7 are keyed on `[solid]` and
  // `[powder]`, and acid is neither, so the self-pair is never registered.
  hardness: 0,
}

const stone: ElementDef = {
  id: STONE,
  name: 'stone',
  colours: ['#6f6a63'],
  tags: ['solid'],
  archetype: { kind: 'static' },
  // Hardness 3 is above rows 6–7's `maxHardness: 1`, so acid + stone is never
  // registered at all — stone is the acid-proof building material you paint.
  hardness: 3,
}

const sulphur: ElementDef = {
  id: SULPHUR,
  name: 'sulphur',
  colours: ['#d6c53c'],
  tags: ['powder', 'flammable'],
  archetype: { kind: 'powder', density: 55, slide: 1 },
  // 2 is above rows 6–7's `maxHardness: 1`, so the acid that just made this
  // grain can never dissolve it back: the runaway loop is impossible by
  // construction rather than headed off by a guard.
  hardness: 2,
}

/** The roster (spec §4, materials spec §3). Pure config — zero behavioural code. */
export const v1Elements: readonly ElementDef[] = [
  dirt,
  sand,
  water,
  lava,
  obsidian,
  wood,
  oil,
  fire,
  smoke,
  steam,
  acid,
  stone,
  sulphur,
]

/**
 * The chemistry (spec §4, materials spec §4 rows 1–9). Rows of data, not hooks
 * — the elements above name neither each other nor the products.
 *
 * **Order is load-bearing**: a tag row registers every pair it covers, and the
 * earlier row wins, so a specific row for a pair inside a tag must come first
 * or it silently never lands.
 */
export const v1Reactions: readonly ReactionRow[] = [
  // Water no longer just freezes lava — it flashes off as well, which is what
  // makes the water cycle visible. (v1 made obsidian on both sides.)
  { a: 'water', b: 'lava', p: 1, aBecomes: 'steam', bBecomes: 'obsidian' },
  { a: 'water', b: 'fire', p: 1, aBecomes: 'steam', bBecomes: 'smoke' },
  // One row covers every fuel, now and later. Rewriting the fire cell clears
  // its `ra` and so restarts its countdown: fire burns while its fuel lasts,
  // then dies to smoke. That is the point of the row, not a side effect.
  { a: 'fire', b: 'flammable', p: 0.4, aBecomes: 'fire', bBecomes: 'fire' },
  // Lava ignites and survives — it is a heat source, not a fuel.
  { a: 'lava', b: 'flammable', p: 0.15, aBecomes: 'lava', bBecomes: 'fire' },
  // **This row must stay above the two below it.** They cover acid + wood as
  // well, via `[solid]` at hardness 1, and `resolvePairs` keeps the first
  // registration and drops the rest without a word — reorder these three and
  // the residue silently stops happening. `acid.test.ts` pins it.
  //
  // The residue goes on the *acid* side: the wood is gone, the cavity is
  // genuinely dug, and the spent acid leaves a grain behind. The other way
  // round turns the wall into a sulphur wall and digs nothing.
  { a: 'acid', b: 'wood', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  // Two cells in, none out. `maxHardness` is checked once at boot, so stone,
  // obsidian and sulphur are not "immune" — their pairs simply do not exist.
  { a: 'acid', b: 'solid', p: 0.3, aBecomes: null, bBecomes: null, maxHardness: 1 },
  { a: 'acid', b: 'powder', p: 0.3, aBecomes: null, bBecomes: null, maxHardness: 1 },
  // Water wins: the acid ends up as more water rather than as a hole.
  { a: 'acid', b: 'water', p: 1, aBecomes: 'water', bBecomes: 'water' },
  // Acid boils off; lava is the heat source and survives, as it does with fuel.
  { a: 'acid', b: 'lava', p: 1, aBecomes: 'smoke', bBecomes: 'lava' },
]
