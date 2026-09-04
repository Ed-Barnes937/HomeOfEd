import { createEvaporation } from './evaporation.ts'
import { createGrowth } from './growth.ts'
import { createSeedBank } from './seedBank.ts'
import { createShed } from './petals.ts'
import { createSprout, createTip } from './stalk.ts'
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
export const ASH = 19
export const BURIED = 20
export const SPROUT = 21
export const TIP = 22
export const STALK = 23
export const FLOWER = 24
export const PETAL = 25

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

/**
 * The roster's sixth hook, and the only one on something that was always here:
 * a one-cell film of water with open air over it lifts as steam (life spec §4.5,
 * ruling 1). It is what stops a puddle poured on saturated ground standing there
 * for the rest of the run, and it leaves ponds and level pools alone by
 * construction. See `evaporation.ts` and
 * [ADR 0044](../../../../docs/adr/0044-silt-thin-film-evaporation.md).
 */
// No `steam` id: a film dries to nothing rather than lofting (ADR 0044 §6), so
// the hook reads two species and produces none of its own.
const evaporate = createEvaporation({ empty: EMPTY, water: WATER })

const water: ElementDef = {
  id: WATER,
  name: 'water',
  colours: ['#6f9fc4', '#648fb0', '#78acd4', '#6b99bc'],
  tags: ['liquid'],
  // Five cells of sideways travel a tick is what makes a poured column read as
  // spreading rather than as a wobbling stack.
  archetype: { kind: 'liquid', density: 30, dispersion: 5 },
  // **No `lifetime`, so `ra` stays the liquid opinion field** (ADR 0038) - and
  // this hook claims no byte at all, which is exactly why it needed `keepAwake`
  // on `Api` instead (life ticket 05, ADR 0044 §3). An element may carry a hook
  // without claiming a byte; water is the first one that does.
  onTick: evaporate,
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
  // film on top — the displacement rule does this, not a special case. The
  // `move` throttle is what makes it read as viscous: half of water's pace,
  // well clear of lava's ooze (0.15), with one cell less spread than water.
  archetype: { kind: 'liquid', density: 20, dispersion: 3, move: 0.5 },
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
 * The first of the roster's two hooks (materials spec §5), shared by moss and
 * vine. Everything else here is data; growth is not, because a reaction row has
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
  // **Seeds rot** (life ticket 04), and it is not a detail. A seed that lands
  // where it cannot germinate - on stone, on a stem, on another seed - was
  // immortal litter, and litter *roofs* the ground it fell on, so the bed under
  // it goes dormant as well. The prototype measured a meadow held hostage to the
  // petal-seed rate without this and holding one population across a tenfold
  // change in that rate with it.
  //
  // Generous on purpose: 1280-2000 ticks is long enough that no seed on its way
  // to soil ever notices, and `every: 8` is what fits it in the byte (the flat
  // form is eight times `MAX_LIFETIME_TICKS`). The *buried* seed keeps no
  // lifetime at all - it is a different species precisely so it can hold its
  // soak counter in `ra` (ADR 0043), so burial is untouched by this.
  lifetime: { ticks: 160, jitter: 90, every: 8, becomes: null },
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

/**
 * What a fire leaves behind (burnables spec §3), and the first half of the
 * ecology loop: ash falls, rain wets it to mud, and a seed banks in it and
 * germinates (life spec §4.1) to regrow what burned. See
 * [ADR 0042](../../../../docs/adr/0042-silt-wood-smolders-as-ember.md) §6.
 */
const ash: ElementDef = {
  id: ASH,
  name: 'ash',
  // Pale grey, and the only grey in the roster that is neither stone nor
  // gas - a burnt-out bed should read as absence rather than as material. A
  // product, so not in the design brief's swatch list; ticket 04 may tune the
  // base and the other three follow it by the mass rule above.
  colours: ['#9b948b', '#8c857d', '#a7a096', '#958e85'],
  // **Not `flammable`.** As ember: the ignition ladder and its
  // `fire + [flammable]` fallback both key on the tag, so leaving it off is
  // what keeps a bed of residue out of the fire rather than a rule saying so.
  tags: ['powder'],
  // Density 35 puts ash between water (30) and mud (50), which is what closes
  // the loop: a grain sinks into a pool instead of floating on it, and rests
  // *on* a wetted bed instead of burying itself in it. Sand (60) and seed (40)
  // both sink past it, so neither a sandfall nor a dropped seed is stopped by
  // a layer of it. It *ties* acid at 35, and `canDisplace` is `mine > theirs`,
  // so ash floats on an acid pool rather than sinking through it - moot in
  // practice, since acid's `[powder]` row dissolves the grain on contact.
  archetype: { kind: 'powder', density: 35, slide: 1 },
  // 0 is the softest rung, so acid's `[powder]` row at maxHardness 1 reaches
  // it: acid erases a bed of ash. Deliberate - it is spent material, not a
  // building block. `ash.test.ts` pins it as a choice rather than a surprise.
  hardness: 0,
}

/**
 * The seed bank (life spec §4.1), the roster's second hook. Both halves of the
 * biome commitment are live now that sprout 21 exists: standing water above a
 * germination makes aquatic moss, open air makes the land sprout. See
 * `seedBank.ts`.
 */
const bank = createSeedBank({ empty: EMPTY, water: WATER, moss: MOSS, dirt: DIRT, sprout: SPROUT })

/**
 * Where a seed goes when it reaches wet soil (life spec §3, §4.1): into it. The
 * bank is what makes a meadow survive a total burn, and what makes germination
 * density dependent without a rule about density - see `seedBank.ts`.
 */
const buried: ElementDef = {
  id: BURIED,
  name: 'buried',
  // **One word**, as every name here is: a name is a mermaid node id in the
  // generated interaction graph and a scene's remap key. The spec calls the
  // element a buried seed; the roster calls it `buried`.
  //
  // A seed husk darkened into the soil - between seed and mud, so a bed reads as
  // ground with lumps in it rather than as seeds sitting on a floor. A product,
  // so not in the design brief's swatch list.
  colours: ['#6e5a33', '#63512e', '#7a6438', '#695531'],
  // **Not `flammable`**, and that is the whole job: the ignition ladder and its
  // `fire + [flammable]` fallback both key on the tag, so leaving it off is what
  // makes the bank survive a fire that clears everything standing over it.
  // `solid` still puts it in acid's reach, which is deliberate - acid erases,
  // fire does not.
  tags: ['solid'],
  // Static, so mud (a liquid, and denser) oozes around it rather than washing it
  // out of the bed it is buried in.
  archetype: { kind: 'static' },
  hardness: 0,
  // **No `lifetime`.** The hook keeps its soak counter in `ra`, which the
  // engine's lifetime feature owns; giving the buried seed a lifetime would hand
  // the byte back and the biome test would read a countdown. This is the
  // grower/product split the seed pair exists for
  // ([ADR 0043](../../../../docs/adr/0043-silt-growers-and-products-split-the-byte.md)).
  onTick: bank,
}

/**
 * The land plant's third hook (life spec §4.3): the sprout raises a stalk tip
 * above itself and is spent doing it. Code rather than a reaction row for the
 * same reason growth is - a row has no direction, and this one only ever grows
 * *up*. See `stalk.ts`.
 */
const raiseStalk = createSprout({ empty: EMPTY, tip: TIP, stalk: STALK })

/**
 * The fourth hook, and the grower half of the pair: the tip climbs on its
 * travelling energy budget, leaves stem behind and blooms when the budget runs
 * out. See `stalk.ts`.
 */
const climb = createTip({ empty: EMPTY, tip: TIP, stalk: STALK, flower: FLOWER })

/**
 * What a seed germinates into on land (life spec §4.2-4.3) - moss's opposite
 * number, and the only one of the two that never touches water. It raises a
 * stalk and nothing else.
 */
const sprout: ElementDef = {
  id: SPROUT,
  name: 'sprout',
  // The brightest green in the roster: a seedling reads as newer growth than
  // either the mat (moss) or the stem it becomes. A product, so not in the
  // design brief's swatch list.
  colours: ['#8ec44a', '#82b543', '#98d150', '#88bd47'],
  tags: ['solid', 'flammable'],
  archetype: { kind: 'static' },
  hardness: 0,
  // **No `lifetime`**, per the roster in life spec §3. Nothing here borrows `ra`
  // either - the sprout is the one member of the pair that needs no per-cell
  // state at all, and it rises on the first tick it has air (`stalk.ts`), so an
  // orphaned seedling is a cell that never got its sky rather than litter.
  onTick: raiseStalk,
}

/**
 * The grower (life spec §2.1, §4.3): it owns `ra` as a travelling energy budget
 * and climbs until the budget is spent, leaving stem behind and blooming at the
 * end. The only cell of the plant that is ever busy.
 */
const tip: ElementDef = {
  id: TIP,
  name: 'tip',
  // **One colour, not four.** The mass rule above is about heaps and walls; a
  // tip is a single travelling cell, and a pale bud reads as the growing end of
  // the stem it leaves behind.
  colours: ['#a9de63'],
  tags: ['solid', 'flammable'],
  archetype: { kind: 'static' },
  hardness: 0,
  // **No `lifetime`.** `ra` is the energy budget, so the byte must stay free -
  // giving the tip a lifetime would hand it back to the engine and the plant
  // would climb on a countdown
  // ([ADR 0043](../../../../docs/adr/0043-silt-growers-and-products-split-the-byte.md)).
  onTick: climb,
}

/**
 * The product (life spec §2.1, §4.3): inert stem, left behind the tip, and it
 * crumbles. **The lifetime is the load-bearing half** - without it a meadow
 * silts up with immortal dead columns, which was the prototype's single most
 * important finding.
 */
const stalk: ElementDef = {
  id: STALK,
  name: 'stalk',
  // Darker than the sprout it grew from and than the tip that left it: the stem
  // is the oldest tissue on the plant.
  colours: ['#5f8f3c', '#568237', '#679a40', '#5b8a3a'],
  tags: ['solid', 'flammable'],
  archetype: { kind: 'static' },
  hardness: 0,
  // 2720-3200 ticks - 45 to 53 s at 60 tps, and the number that matters is that
  // the *minimum* clears the flower's maximum: a stem that crumbled first would
  // leave a static flower hanging in the air. Written coarsely because the flat
  // form does not fit the byte at all: `every: 16` makes the countdown count
  // draws rather than ticks (life ticket 01), so `ticks` and `jitter` here are
  // in units of 16. Doubled with the flower in life ticket 06.
  lifetime: { ticks: 170, jitter: 30, every: 16, becomes: null },
}

/**
 * The meadow's palette, shared by the flower and the petals it drops. Eight
 * divides `VARIANT_SLOTS` exactly, so each colour comes up in one slot in eight -
 * `rb & 7` and nothing else, and per-cell variety is free (ADR 0040). It is what
 * makes a meadow read as a meadow rather than as one flower stamped out twenty
 * times. `colours[0]` still leads, as everywhere: it is the flower a reader
 * pictures.
 *
 * **A petal shares the palette, never the parent's shade** (life spec §2.5).
 * `rb` is reseeded on every birth and no element may write it, so a petal's
 * colour is drawn afresh - the same pastels, statistically identical in a drift,
 * and no way to trace one back to the flower it came from.
 */
const PASTELS: readonly string[] = [
  '#f2b8c6',
  '#f7d6e0',
  '#e3c2ef',
  '#c8d6f6',
  '#bde5df',
  '#f8e3b2',
  '#f6c9a8',
  '#e8bcd9',
]

/**
 * The fifth hook (life spec §4.4): a living flower lets the odd petal go. The
 * *death* drop is not a hook - see `petals.ts`.
 */
const shed = createShed({ empty: EMPTY, petal: PETAL })

/**
 * The plant's last cell (life spec §4.3-4.4), and where the meadow loop closes:
 * a withering flower leaves a falling seed in its own cell and throws 3-4 petals
 * clear of it, so seed -> buried -> sprout -> stalk -> flower -> seed comes round
 * without a rule anywhere that says "reproduce".
 */
const flower: ElementDef = {
  id: FLOWER,
  name: 'flower',
  colours: PASTELS,
  tags: ['solid', 'flammable'],
  archetype: { kind: 'static' },
  hardness: 0,
  // 1200-2400 ticks (20-40 s), coarse for the same reason the stem is: the flat
  // form is many times `MAX_LIFETIME_TICKS` and the registry refuses it at boot.
  //
  // **This is the density knob, and it is here rather than in `seedBank.ts`**
  // (life ticket 06, ruling 4). A land plant drinks one cell of soil to exist
  // (ruling 2), so a bed of N cells only ever pays for N plants - which makes
  // the standing crown count a plant's *lifetime* divided by the window, and
  // germination merely the speed the bed is spent at. Doubling this from
  // 600-1200 doubles the crowns a cell of water holds up: measured on the
  // 261-cell reference bed over seeds 1-6, the settled band went from 5-23 to
  // 19-47, with the bed's drying horizon unmoved at ~20,000 ticks. The stem's
  // countdown moved with it - it has to outlast the flower it carries.
  //
  // **The death drop** (life ticket 04). `emits` is the engine affordance a
  // single-valued `becomes` could not give this: the seed is what is left *in*
  // the cell, the petals are thrown into whatever is free around it, and neither
  // could be a hook because `onTick` never runs on the tick a lifetime expires
  // (ADR 0043 §4). **3-4, and 3 is the floor** - 1-2 measured as very nearly
  // invisible in the prototype.
  lifetime: {
    ticks: 75,
    jitter: 75,
    every: 16,
    becomes: 'seed',
    emits: { species: 'petal', min: 3, max: 4 },
  },
  onTick: shed,
}

/**
 * The garnish, and quietly also the offspring (life spec §4.4). A slow powder
 * rather than a liquid: it needs a drifting, jittery fall, and the liquid
 * archetype's levelling would have a drift of petals pool like spilled paint.
 */
const petal: ElementDef = {
  id: PETAL,
  name: 'petal',
  // The flower's palette, drawn afresh per petal - see `PASTELS`.
  colours: PASTELS,
  // **Not `flammable`, on purpose.** The ignition ladder and its
  // `fire + [flammable]` fallback both key on the tag, so leaving it off is what
  // keeps fire from riding a drift of petals across the world - which is funny
  // once and then ruins every meadow downwind of a spark.
  tags: ['powder'],
  // Density 10 is the lightest thing in the roster, so a petal displaces
  // nothing at all and **floats on water** (10 against water's 30) - deliberate,
  // petals on a pond are the point. The seed it may strike into is denser (40)
  // and sinks straight through, which is the whole of pond succession. `move`
  // 0.25 is the powder throttle life ticket 01 added for exactly this case: sand's
  // kernel taken one tick in four, so a petal wanders down where a grain drops.
  archetype: { kind: 'powder', density: 10, slide: 1, move: 0.25 },
  // As every plant part: hardness 0 puts it in reach of acid's `[powder]` row.
  hardness: 0,
  // 80-150 ticks - 1.5 to 2.5 s, and the one lifetime in this epic that fits the
  // byte flat, so no `every`. Long enough to drift a few cells and to get its
  // draws where it lands, short enough that a meadow is not buried in litter.
  lifetime: { ticks: 80, jitter: 70, becomes: null },
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
  ash,
  buried,
  sprout,
  tip,
  stalk,
  flower,
  petal,
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
  // **Dry parts burn, wet parts steam** (life spec §4.5, §2.4). The prototype
  // ignited every plant cell into a weighted three-way split - 30% steam, 15%
  // ash, 55% fire - and the engine cannot express that: one row per pair, and
  // `p` is a rate and never a share. So the split becomes a *per-species*
  // choice, and these two rows are the wet half: a flower and a seedling are
  // mostly water, so what leaves them is the water, not a flame.
  //
  // The rate is the fallback's own 0.4, unchanged: these rows swap the product,
  // not the ignition. And the fire cell survives as fire, exactly as it does on
  // every other rung - what makes a flower a poor fuel is that it hands the
  // flame nothing, not that it puts it out. `water + fire` is the row that puts
  // fire out, and a flower is not a bucket of water.
  //
  // **Above the tag row below them**, the same trap as `acid + wood`: the tag row
  // covers both of these pairs and `resolvePairs` keeps the first registration
  // and drops the rest without a word. Reorder them and wet biomass silently
  // goes back to burning. The stem and the travelling tip are deliberately *not*
  // here: the stem is the plant's dry tissue and the tip is on screen for about
  // thirty ticks, so both stay on the ladder and are what carries a fire up a
  // meadow at all.
  { a: 'fire', b: 'flower', p: 0.4, aBecomes: 'fire', bBecomes: 'steam' },
  { a: 'fire', b: 'sprout', p: 0.4, aBecomes: 'fire', bBecomes: 'steam' },
  // The fallback, and the default every future flammable arrives on.
  { a: 'fire', b: 'flammable', p: 0.4, aBecomes: 'fire', bBecomes: 'fire' },
  // **The residue branch** (spec §3): open flame beside a smoldering cell
  // occasionally burns it straight down to ash instead of letting it erupt.
  // This is the probabilistic fork a single-valued `lifetime.becomes` cannot
  // express - most embers flame, some become residue - so it is a row.
  //
  // **Read the `p` as a rate, not as a share**, which is why it is this small.
  // The draw is offered every tick and an ember glows for 120-180 of them, so
  // what "most embers flame" costs is `1 - (1 - p)^150`, not `p` - and the
  // spec's first 0.05 turned out to mean an exposed ember almost never erupts.
  // The sweep behind 0.003 is in
  // [ADR 0042](../../../../docs/adr/0042-silt-wood-smolders-as-ember.md) §6.
  //
  // Below the tag row rather than above it because it is not part of the
  // ignition ladder: ember carries no `flammable` tag, so no tag row claims
  // this pair and its position is free. It sits with the fire rows for
  // legibility, not for precedence.
  { a: 'fire', b: 'ember', p: 0.003, aBecomes: 'fire', bBecomes: 'ash' },
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
  // **This row must stay above the `[solid]`/`[powder]` pair below.** They cover
  // acid + wood as well, via `[solid]` at hardness 1, and `resolvePairs` keeps
  // the first registration and drops the rest without a word - reorder these
  // rows and the residue silently stops happening. `acid.test.ts` pins it, for
  // wood and for each of the eight plants that follow.
  //
  // The residue goes on the *acid* side: the wood is gone, the cavity is
  // genuinely dug, and the spent acid leaves a grain behind. The other way
  // round turns the wall into a sulphur wall and digs nothing.
  { a: 'acid', b: 'wood', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  // **The same row, once per living thing** (discovery ticket 15), and the same
  // precedence warning applies to all eight: every plant is hardness 0, so the
  // two rows below cover these pairs as well and a reorder would silently take
  // the residue away. Wood's numbers exactly - the rationale is wood's too, that
  // spent acid leaves a grain behind, and organic matter is organic matter.
  //
  // Before this, `acid + wood` was sulphur's only recipe: acid digesting a
  // meadow left nothing while acid digesting a plank left brimstone. Now the
  // life loop is a renewable route to it.
  //
  // **Eight literal rows rather than a `plantMatter` tag**, though the tag would
  // read tidier here. The registry expands tag rows before anything downstream
  // sees them, so the graph doc and the field-notes denominators come out
  // identical either way and the tag buys nothing but this block's length. What
  // it would cost is a membership question nobody has ruled on: `buried` is
  // plant matter by any plain reading and is not among the eight the roster
  // names, and every plant part added later would join the sulphur rule silently
  // rather than by decision. The tags already here (`flammable`, `solid`, `powder`) are
  // broad contracts many rows read; a tag with one consumer would move a
  // reaction's membership into the element defs, which is the split this file's
  // rules draw the other way round. The `fire + <fuel>` ladder above
  // `fire + flammable` is the precedent: named rows first, tag row behind them.
  //
  // Ember and ash are the roster's other half and get no row: they are already
  // spent material, so the tag rows erase them with no residue (the ash comment
  // above rules it), and `acid.test.ts` pins that as a choice. `buried` keeps the
  // tag rows too, for want of a ruling either way.
  //
  // The measured cost of all this is that **acid is a weaker tool against a
  // plant wall than it was**: the residue backfills the cavity and acid cannot
  // eat sulphur, so a bath armours the bed it is eating. The numbers are in
  // [ADR 0050](../../../../docs/adr/0050-silt-acid-corrodes-living-matter-and-lets-water-be.md)
  // §1, which supersedes the materials spec's "residue is wood only" ruling and
  // records that the objection that ruling made was correct and accepted.
  { a: 'acid', b: 'moss', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  { a: 'acid', b: 'vine', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  { a: 'acid', b: 'seed', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  { a: 'acid', b: 'sprout', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  { a: 'acid', b: 'stalk', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  { a: 'acid', b: 'tip', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  { a: 'acid', b: 'flower', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  { a: 'acid', b: 'petal', p: 0.3, aBecomes: 'sulphur', bBecomes: null },
  // Two cells in, none out. `maxHardness` is checked once at boot, so stone,
  // obsidian and sulphur are not "immune" — their pairs simply do not exist.
  { a: 'acid', b: 'solid', p: 0.3, aBecomes: null, bBecomes: null, maxHardness: 1 },
  { a: 'acid', b: 'powder', p: 0.3, aBecomes: null, bBecomes: null, maxHardness: 1 },
  // **No `acid + water` row, and that is a decision** (discovery ticket 16).
  // There was one - `-> water + water` at p 1, "water wins" - and it made a
  // single drip a total, instant counter to a whole pool while charting, in the
  // field notes, as two things going in and one of them coming out unchanged.
  // The two liquids simply coexist now: acid is denser (35 against 30), so
  // density decides the layering exactly as it does for every other pair of
  // liquids, and **stone stays the one acid-proof answer**, which is stone's
  // whole job. Nothing migrates - the field notes' denominators are derived, and
  // a stored `react:acid+water` key is carried-but-ignored like any other
  // unknown key.
  // [ADR 0050](../../../../docs/adr/0050-silt-acid-corrodes-living-matter-and-lets-water-be.md)
  // §2 supersedes the materials spec's row 8 and records the two alternatives
  // (a dilution residue, and acid tainting water) that were turned down.
  //
  // Acid boils off; lava is the heat source and survives, as it does with fuel.
  { a: 'acid', b: 'lava', p: 1, aBecomes: 'smoke', bBecomes: 'lava' },
  // Two cells in, one out, as with acid + wood: the water is spent soaking the
  // dirt. Dirt only — sand plus water is wet sand, and a lake quietly turning a
  // whole sand bed to ooze annoys more than it delights.
  { a: 'water', b: 'dirt', p: 0.4, aBecomes: null, bBecomes: 'mud' },
  // The same row with the bed swapped, and the second half of the ash loop
  // (spec §3): wetting a bed of residue is the same act as wetting a bed of
  // soil, so it is the same shape and the same p. Which is what makes what
  // burned fertile again - the burial row and the bank's hook do the rest.
  // Ash is a powder, so acid's `[powder]` row covers `acid + ash`, but nothing
  // above claims *this* pair, so the row is safe here beside its twin.
  { a: 'water', b: 'ash', p: 0.4, aBecomes: null, bBecomes: 'mud' },
  // The two heat levels. Mud carries no `flammable` tag and is a liquid, so
  // neither `fire + [flammable]` nor acid's `[solid]`/`[powder]` rows cover
  // these pairs — naming both sides explicitly keeps them out of the tags
  // regardless of where they sit in the table.
  //
  // **The quench** (life spec §4.5): the flame dries one cell of soil and is
  // itself lofted as the steam that soil's water became. It used to leave smoke,
  // which *deleted* the water - the one rule in the table that did, and the
  // reason a burnt bed could never rain on its own ashes
  // ([ADR 0045](../../../../docs/adr/0045-silt-the-water-ledger.md)). Two things
  // fall out of it for free: fire spreads through the plants standing on a bed
  // but never along it, and a wildfire makes its own weather.
  { a: 'mud', b: 'fire', p: 1, aBecomes: 'dirt', bBecomes: 'steam' },
  // Lava bakes rather than dries, and survives — a heat source, not a reagent.
  { a: 'mud', b: 'lava', p: 1, aBecomes: 'stone', bBecomes: 'lava' },
  // **Burial, which replaced instant germination rather than joining it** (life
  // spec §4.1). One reaction row per pair and `p` is a rate, never a split
  // (spec §2.4), so `seed + mud -> moss` at p 1 and this row **cannot coexist**:
  // a seed cannot both sprout on contact and sink one time in ten. All
  // germination therefore routes through the bank's hook (`seedBank.ts`), which
  // is what buys the fire-proof bank and the one-shot biome decision.
  //
  // The *soil* cell is the one that becomes the seed and the seed cell is spent:
  // the bank lives in the ground, under the surface fire cannot reach. It also
  // costs a cell of soil, which germination gives back as dirt - that trade is
  // the whole of what caps the bank.
  //
  // Still a reaction rather than a hook, and still safe at the tail of the
  // table: nothing above claims this pair, since mud is a liquid and acid's
  // `[solid]`/`[powder]` rows never reach it.
  { a: 'seed', b: 'mud', p: 0.1, aBecomes: null, bBecomes: 'buried' },
  // **The petal strikes** (life spec §4.4, ruling 3): petal drift doubles as
  // reproduction. A petal that comes to rest on open wet soil usually takes -
  // read the `p` as a rate and not as a share, as with the ember's residue
  // branch: the draw is offered every tick the petal touches the soil and a petal
  // lives 80-150 of them, so 0.01 is about two thirds over its life rather than
  // one in a hundred.
  //
  // The rate is also **not the knob it looks like**. Measured across a tenfold
  // change in it, the meadow settles at the same size, because what limits
  // reproduction is how often a petal reaches open wet ground at all - a dense
  // meadow roofs its own bed. Petal-seeds hold at about a sixth of all
  // germinations however hard it is pushed.
  { a: 'petal', b: 'mud', p: 0.01, aBecomes: 'seed', bBecomes: 'mud' },
  // An order of magnitude below it, and **deliberately garnish** (ruling 3): at
  // one strike in a thousand per contact tick, petals landing on a pond fire
  // about once in twenty thousand ticks. What actually turns a pond into a marsh
  // is seeds tumbling in over the bank, and that is fine - the struck seed is
  // denser than water so it sinks, the pond floor banks it, and a floor of vine
  // arrives on a 5000-10,000 tick timescale, never before the meadow itself.
  //
  // Both rows are safe at the tail of the table: petal carries only `powder`, so
  // no `fire + [flammable]` reaches it, and every water and mud row above names
  // both of its sides.
  { a: 'petal', b: 'water', p: 0.001, aBecomes: 'seed', bBecomes: 'water' },
]
