import { createGrowth } from './growth.ts'
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
export const MUD = 14
export const SEED = 15
export const MOSS = 16
export const VINE = 17
export const EMBER = 18

/**
 * Out-of-bounds sentinel. Reads past the edge return this, so no element ever
 * branches on edges — the world behaves as if walled.
 */
export const WALL = 255

/*
 * ## Colour variants — the rule every element below follows
 *
 * Every element that forms a mass — a heap, a pool, a wall — declares four
 * shades rather than one, and each cell picks between them by the variant byte
 * the sim seeds into `rb` at birth (ADR 0040). Without it a pile of sand renders
 * as a slab. The shades are the base colour at ×1.00, ×0.90, ×1.08 and ×0.96,
 * roughly ±10% of luminance: enough to read as grain at the 300×200 grid's
 * on-screen scale, not enough to read as a second material.
 *
 * Two rules hold this together, both load-bearing:
 *
 * - **`colours[0]` is the base**, because the rail swatch reads `colours[0]`
 *   and the rail must not drift from the canvas (spec §9).
 * - **Four divides `VARIANT_SLOTS` (8)**, so the shades come up in equal shares
 *   (`../features/render/speciesPalette.ts`).
 *
 * The three gases keep their single colour. Their motion already breaks up the
 * mass, and the gas archetype is the one the sandspiel spec flags as possibly
 * changing — `rb` is what an isotropic-walk gas would want for its molecule
 * count, so leaving it unclaimed there costs nothing today.
 */

const dirt: ElementDef = {
  id: DIRT,
  name: 'dirt',
  colours: ['#8a7358', '#7c684f', '#957c5f', '#846e54'],
  tags: ['solid'],
  archetype: { kind: 'static' },
  // The hardness pass (materials spec §3) lands here, where acid first reads
  // it: 0 is "anything dissolves this", and it is also the registry's default.
  hardness: 0,
}

const sand: ElementDef = {
  id: SAND,
  name: 'sand',
  colours: ['#d9b978', '#c3a76c', '#eac882', '#d0b273'],
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
  colours: ['#6f9fc4', '#648fb0', '#78acd4', '#6b99bc'],
  tags: ['liquid'],
  // Five cells of sideways travel a tick is what makes a poured column read as
  // spreading rather than as a wobbling stack.
  archetype: { kind: 'liquid', density: 30, dispersion: 5 },
}

const lava: ElementDef = {
  id: LAVA,
  name: 'lava',
  colours: ['#d4622a', '#bf5826', '#e56a2d', '#cc5e28'],
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
  colours: ['#2a2430', '#26202b', '#2d2734', '#28232e'],
  tags: ['solid'],
  archetype: { kind: 'static' },
  // The top of the hardness ladder: nothing in the roster corrodes it, which
  // is what makes it the material to build an acid-proof tank out of.
  hardness: 5,
}

const wood: ElementDef = {
  id: WOOD,
  name: 'wood',
  colours: ['#6b4a2a', '#604326', '#74502d', '#674728'],
  tags: ['solid', 'flammable'],
  archetype: { kind: 'static' },
  // Hardness 1 is what later lets acid eat wood while obsidian shrugs it off
  // (materials spec §3); nothing in this group reads it yet.
  hardness: 1,
}

const oil: ElementDef = {
  id: OIL,
  name: 'oil',
  colours: ['#46402c', '#3f3a28', '#4c4530', '#433d2a'],
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
  colours: ['#8fd128', '#81bc24', '#9ae22b', '#89c926'],
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
  colours: ['#6f6a63', '#645f59', '#78726b', '#6b665f'],
  tags: ['solid'],
  archetype: { kind: 'static' },
  // Hardness 3 is above rows 6–7's `maxHardness: 1`, so acid + stone is never
  // registered at all — stone is the acid-proof building material you paint.
  hardness: 3,
}

const sulphur: ElementDef = {
  id: SULPHUR,
  name: 'sulphur',
  colours: ['#d6c53c', '#c1b136', '#e7d541', '#cdbd3a'],
  tags: ['powder', 'flammable'],
  archetype: { kind: 'powder', density: 55, slide: 1 },
  // 2 is above rows 6–7's `maxHardness: 1`, so the acid that just made this
  // grain can never dissolve it back: the runaway loop is impossible by
  // construction rather than headed off by a guard.
  hardness: 2,
}

const mud: ElementDef = {
  id: MUD,
  name: 'mud',
  // Wet dirt: the same hue as dirt, darkened, so a wetted bed reads as the
  // same ground rather than as a new material dropped on top of it.
  colours: ['#5b4632', '#523f2d', '#624c36', '#574330'],
  tags: ['liquid'],
  // Denser than water (30), so it settles under a pool rather than clouding
  // it, and lighter than sand (60), so a grain still sinks through. The
  // slowest liquid in the roster: one cell of spread and roughly one tick in
  // ten, which is what makes it ooze rather than flow.
  archetype: { kind: 'liquid', density: 50, dispersion: 1, move: 0.1 },
}

/**
 * The one hook in the roster (materials spec §5), shared by moss and vine.
 * Everything else here is data; growth is not, because a reaction row has
 * neither a direction nor a brake. See `growth.ts`.
 */
const grow = createGrowth(WATER, MOSS, VINE)

const seed: ElementDef = {
  id: SEED,
  name: 'seed',
  // A husk, not a grain: darker and greener than sand and than sulphur, both
  // of which it otherwise sits between on the powder shelf.
  colours: ['#9c8348', '#8c7641', '#a88d4e', '#967e45'],
  tags: ['powder', 'flammable'],
  // Denser than water (30) and lighter than mud (50), so a seed sinks through
  // a pool and comes to rest *on* the soil instead of burying itself in it —
  // which is what puts the sprout on the surface where it can be seen.
  archetype: { kind: 'powder', density: 40, slide: 1 },
  // 0 is all three plants need to dissolve: rows 6-7 already cover `[powder]`
  // and `[solid]` at `maxHardness: 1`, so acid needs no row of its own here.
  hardness: 0,
}

const moss: ElementDef = {
  id: MOSS,
  name: 'moss',
  colours: ['#4a7a34', '#436e2f', '#508438', '#477532'],
  tags: ['solid', 'flammable'],
  archetype: { kind: 'static' },
  hardness: 0,
  // **No `lifetime`.** The hook keeps its branch count in `ra`, which the
  // engine's lifetime feature owns; giving moss a lifetime would hand the byte
  // back and silently uncap growth. See the comment in `growth.ts`.
  onTick: grow,
}

const vine: ElementDef = {
  id: VINE,
  name: 'vine',
  // Brighter than moss: a climbing shoot reads as newer growth than the mat it
  // came from.
  colours: ['#79b74a', '#6da543', '#83c650', '#74b047'],
  tags: ['solid', 'flammable'],
  archetype: { kind: 'static' },
  hardness: 0,
  // The same hook, so a vine climbs on from where the moss left off. Also no
  // `lifetime`, for the same reason.
  onTick: grow,
}

/**
 * Wood's smolder phase (burnables spec §2), and the reason wood reads as wood
 * rather than as slow oil: the contact point chars and glows, the glow creeps
 * along the beam, and only then does it erupt into open flame.
 *
 * A species rather than a per-cell heat field, because everything it needs is
 * already here: a lifetime for the glow, reaction rows for the creep and the
 * douse. See [ADR 0042](../../../../docs/adr/0042-silt-wood-smolders-as-ember.md).
 */
const ember: ElementDef = {
  id: EMBER,
  name: 'ember',
  // Glowing char. Not in the design brief's swatch list, like obsidian and
  // sulphur - a reaction product, not something you paint. Ticket 04 may tune
  // the base; the other three follow it by the mass rule above.
  colours: ['#b3401d', '#a13a1a', '#c1451f', '#ac3d1c'],
  // **Not `flammable`.** It is already burning, so no ignition row may reach
  // it - including the `fire + [flammable]` fallback, which would otherwise
  // flash a smoldering wall the moment its own eruption lit a neighbour.
  tags: ['solid'],
  archetype: { kind: 'static' },
  // As wood: acid's `[solid]` row at maxHardness 1 still eats a charred wall.
  hardness: 1,
  // 2–3 s of glow at 60 tps, then open flame - which cascades, rises and dies
  // to smoke exactly as fire always has. 180 total is under
  // `MAX_LIFETIME_TICKS`, and the countdown owns `ra`, which is why this is a
  // static element: no opinion field and no growth count to collide with.
  lifetime: { ticks: 120, jitter: 60, becomes: 'fire' },
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
  mud,
  seed,
  moss,
  vine,
  ember,
]

/**
 * The chemistry (spec §4, materials spec §4 rows 1–13). Rows of data, not hooks
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
  // **The ignition ladder** (burnables spec §1). Each fuel has its own
  // probability, which is its whole character: sulphur is flash powder and a
  // heap chains instantly, oil flashes, a vine burns as a fuse fast enough to
  // route fire along a grown line, a seed pops, and a mat of moss takes visible
  // time to consume. Every row here rewrites the fire cell, which clears its
  // `ra` and so restarts its countdown: fire burns while its fuel lasts, then
  // dies to smoke. That is the point of the rows, not a side effect.
  //
  // **These rows must stay above the tag row below them**, the same trap as
  // `acid + wood` further down: the tag row covers every one of these pairs as
  // well, and `resolvePairs` keeps the first registration and drops the rest
  // without a word - reorder them and a fuel silently reverts to 0.4, and wood
  // silently goes back to flashing rather than charring. `fire.test.ts` pins it.
  //
  // Wood is the one fuel that never becomes fire directly: it chars first
  // (spec §2, the ember rows below).
  { a: 'fire', b: 'sulphur', p: 1, aBecomes: 'fire', bBecomes: 'fire' },
  { a: 'fire', b: 'oil', p: 0.9, aBecomes: 'fire', bBecomes: 'fire' },
  { a: 'fire', b: 'vine', p: 0.6, aBecomes: 'fire', bBecomes: 'fire' },
  { a: 'fire', b: 'seed', p: 0.3, aBecomes: 'fire', bBecomes: 'fire' },
  { a: 'fire', b: 'moss', p: 0.2, aBecomes: 'fire', bBecomes: 'fire' },
  { a: 'fire', b: 'wood', p: 0.2, aBecomes: 'fire', bBecomes: 'ember' },
  // The fallback, and the default every future flammable arrives on.
  { a: 'fire', b: 'flammable', p: 0.4, aBecomes: 'fire', bBecomes: 'fire' },
  // Lava chars wood too, and more slowly than it lights anything else - but it
  // is still the heat source it is everywhere else, so it survives. **Above
  // the tag row**, which covers this pair as well.
  { a: 'lava', b: 'wood', p: 0.1, aBecomes: 'lava', bBecomes: 'ember' },
  // Lava ignites and survives — it is a heat source, not a fuel.
  { a: 'lava', b: 'flammable', p: 0.15, aBecomes: 'lava', bBecomes: 'fire' },
  // **The creep** (spec §2): a smolder walks through a beam one orthogonal
  // contact at a time, slowly enough to watch. The a-side rewrite is not a
  // typo - rewriting the ember cell clears its `ra` and so restarts its
  // countdown, which is exactly the intent: an ember with fuel still beside it
  // goes on smoldering, and only once its wood is gone (or the 0.02 draws keep
  // missing) does the countdown run out and the cell erupt. It also re-rolls
  // `rb`, so a smoldering mass shimmers a little - also a feature.
  //
  // No tag row above claims this pair, since ember is not `flammable` and the
  // acid rows are acid-keyed, so this row is safe here.
  { a: 'ember', b: 'wood', p: 0.02, aBecomes: 'ember', bBecomes: 'ember' },
  // **The douse**: rain saves a smoldering structure, which is a player verb
  // the instant burn never offered. Back to wood rather than to char, because
  // a "damp char" species would earn its place only if this reads wrong in
  // play. Mirrors `water + fire` at p 1.
  { a: 'water', b: 'ember', p: 1, aBecomes: 'steam', bBecomes: 'wood' },
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
  // Two cells in, one out, as with acid + wood: the water is spent soaking the
  // dirt. Dirt only — sand plus water is wet sand, and a lake quietly turning a
  // whole sand bed to ooze annoys more than it delights.
  { a: 'water', b: 'dirt', p: 0.4, aBecomes: null, bBecomes: 'mud' },
  // The two heat levels. Mud carries no `flammable` tag and is a liquid, so
  // neither `fire + [flammable]` nor acid's `[solid]`/`[powder]` rows cover
  // these pairs — naming both sides explicitly keeps them out of the tags
  // regardless of where they sit in the table.
  { a: 'mud', b: 'fire', p: 1, aBecomes: 'dirt', bBecomes: 'smoke' },
  // Lava bakes rather than dries, and survives — a heat source, not a reagent.
  { a: 'mud', b: 'lava', p: 1, aBecomes: 'stone', bBecomes: 'lava' },
  // Sprouting **is** a reaction — it has a fixed outcome and needs no
  // direction. The soil is not consumed: mud is the bed, not the fuel. Nothing
  // above claims this pair (mud is a liquid, so acid's `[solid]`/`[powder]`
  // rows never reach it), so the row is safe at the tail of the table.
  { a: 'seed', b: 'mud', p: 1, aBecomes: 'moss', bBecomes: 'mud' },
]
