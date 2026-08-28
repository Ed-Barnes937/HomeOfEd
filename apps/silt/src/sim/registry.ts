import { EMPTY, WALL } from './elements.ts'
import { MAX_LIFETIME_TICKS, VARIANT_SLOTS } from './constants.ts'
import type { Archetype, ElementDef, ReactionRow } from './types.ts'

/**
 * A `ReactionRow` with its names and tags resolved to species ids, which is the
 * form the scan uses: one map lookup per neighbour, no tag matching at runtime.
 */
export interface Reaction {
  p: number
  /** What the cell being scanned becomes; `EMPTY` clears it. */
  aBecomes: number
  /** What its neighbour becomes. */
  bBecomes: number
}

/** A `Lifetime` with `becomes` resolved and `jitter` defaulted. */
export interface ResolvedLifetime {
  ticks: number
  jitter: number
  becomes: number
}

export interface ElementRegistry {
  /** `undefined` for ids nothing is registered under. */
  get(id: number): ElementDef | undefined
  /**
   * The roster as registered, without the engine's `empty`/`wall`
   * pseudo-elements. Scene persistence needs both directions of the
   * id↔name mapping, and names are what survive an id renumbering.
   */
  all(): readonly ElementDef[]
  has(id: number, tag: string): boolean
  /** `undefined` for archetypes that cannot be displaced (static, wall). */
  density(id: number): number | undefined
  /** The rule for this ordered pair of species, if the table holds one. */
  reactionFor(a: number, b: number): Reaction | undefined
  lifetimeOf(id: number): ResolvedLifetime | undefined
}

/**
 * The displacement rule, in one place. Strictly density-ordered: equal
 * densities never swap, or two neighbours would trade places forever. Both the
 * in-chunk path (`CellApi.tryMove`) and the deferred cross-chunk path
 * (`DeferredMoves`) ask this, so the two can never disagree.
 */
export function canDisplace(registry: ElementRegistry, mover: number, target: number): boolean {
  if (target === WALL) return false
  if (target === EMPTY) return true
  const mine = registry.density(mover)
  const theirs = registry.density(target)
  return mine !== undefined && theirs !== undefined && mine > theirs
}

const HEX = /^#[0-9a-f]{6}$/i

/** Engine-owned pseudo-elements. Registering them keeps every lookup total. */
const empty: ElementDef = {
  id: EMPTY,
  name: 'empty',
  colours: ['#181510'],
  tags: [],
  archetype: { kind: 'static' },
}

const wall: ElementDef = {
  id: WALL,
  name: 'wall',
  colours: ['#181510'],
  tags: ['wall', 'solid'],
  archetype: { kind: 'static' },
}

function densityOf(archetype: Archetype): number | undefined {
  return archetype.kind === 'static' ? undefined : archetype.density
}

function checkArchetype(archetype: Archetype, fail: (message: string) => void): void {
  switch (archetype.kind) {
    case 'static':
      return
    case 'powder':
      if (!Number.isFinite(archetype.density)) fail('density must be a number')
      if (!(archetype.slide >= 0 && archetype.slide <= 1)) {
        fail('slide must be a probability in [0, 1]')
      }
      return
    case 'liquid':
    case 'gas':
      if (!Number.isFinite(archetype.density)) fail('density must be a number')
      // A gas floats because nothing is lighter than it, not because it pushes:
      // the sign is what makes every other archetype sink past it.
      if (archetype.kind === 'gas' && !(archetype.density < 0)) {
        fail('gas density must be negative')
      }
      if (!(Number.isInteger(archetype.dispersion) && archetype.dispersion >= 0)) {
        fail('dispersion must be a non-negative whole number of cells')
      }
      if (archetype.move !== undefined && !(archetype.move > 0 && archetype.move <= 1)) {
        fail('move must be a probability in (0, 1]')
      }
      return
    default: {
      const exhaustive: never = archetype
      fail(`unknown archetype ${JSON.stringify(exhaustive)}`)
    }
  }
}

type ByName = ReadonlyMap<string, ElementDef>

/** Species ids fit in a byte, so an ordered pair fits in one integer key. */
function pairKey(a: number, b: number): number {
  return (a << 8) | b
}

/** Every id is a byte, so every lookup keyed by one is a 256-slot array. */
const SPECIES_SLOTS = 256
const PAIR_SLOTS = SPECIES_SLOTS * SPECIES_SLOTS
const NO_REACTION = -1
/** `Int16Array` holds indices up to this; a roster past it must not truncate. */
const MAX_REACTIONS = 32767

interface PairTable {
  /** `NO_REACTION`, or an index into `list`. */
  index: Int16Array
  list: readonly Reaction[]
}

/** Every element a reaction side names — one by name, or all carrying the tag. */
function sidesOf(defs: readonly ElementDef[], byName: ByName, side: string): ElementDef[] {
  const named = byName.get(side)
  return named ? [named] : defs.filter((def) => def.tags.includes(side))
}

/**
 * Flattens the tag-keyed table into an id-pair lookup, once, at boot. Tags buy
 * a table that does not grow with the roster; expanding them here buys an O(1)
 * lookup per neighbour. Both entries of a pair are stored, with the `becomes`
 * sides swapped, so the answer does not depend on which cell the scan reaches
 * first. Where two rows cover the same pair the earlier row wins.
 */
function resolvePairs(
  defs: readonly ElementDef[],
  byName: ByName,
  reactions: readonly ReactionRow[],
): PairTable {
  // 65536 slots is every ordered byte pair, so the lookup is one indexed load
  // and no hashing. `-1` is "no rule"; anything else indexes `list`.
  const index = new Int16Array(PAIR_SLOTS).fill(NO_REACTION)
  const list: Reaction[] = []
  const speciesOf = (name: string | null) => (name === null ? EMPTY : byName.get(name)!.id)
  const add = (a: number, b: number, reaction: Reaction) => {
    const key = pairKey(a, b)
    // The earlier row wins, exactly as the `Map` form did: a specific pair must
    // survive a later tag row that also covers it (acid + wood).
    if (index[key] !== NO_REACTION) return
    if (list.length > MAX_REACTIONS) {
      throw new Error(`too many distinct reactions — the pair table holds ${MAX_REACTIONS}`)
    }
    index[key] = list.length
    list.push(reaction)
  }

  for (const row of reactions) {
    const aBecomes = speciesOf(row.aBecomes)
    const bBecomes = speciesOf(row.bBecomes)

    for (const a of sidesOf(defs, byName, row.a)) {
      for (const b of sidesOf(defs, byName, row.b)) {
        // Hardness is fixed per element, so a pair the row is too weak to touch
        // is simply never registered rather than re-checked every tick.
        if (row.maxHardness !== undefined) {
          const limit = row.maxHardness
          if ((a.hardness ?? 0) > limit || (b.hardness ?? 0) > limit) continue
        }
        add(a.id, b.id, { p: row.p, aBecomes, bBecomes })
        add(b.id, a.id, { p: row.p, aBecomes: bBecomes, bBecomes: aBecomes })
      }
    }
  }

  return { index, list }
}

function resolveLifetimes(
  defs: readonly ElementDef[],
  byName: ByName,
): (ResolvedLifetime | undefined)[] {
  const lifetimes = new Array<ResolvedLifetime | undefined>(SPECIES_SLOTS).fill(undefined)
  for (const def of defs) {
    const { lifetime } = def
    if (!lifetime) continue
    lifetimes[def.id] = {
      ticks: lifetime.ticks,
      jitter: lifetime.jitter ?? 0,
      becomes: lifetime.becomes === null ? EMPTY : byName.get(lifetime.becomes)!.id,
    }
  }
  return lifetimes
}

/**
 * Builds the registry, refusing to boot on a malformed roster (spec §5.2).
 * Every problem is collected and reported together — a half-valid registry is
 * never handed back, and one typo does not hide the next.
 */
export function createRegistry(
  defs: readonly ElementDef[],
  reactions: readonly ReactionRow[] = [],
): ElementRegistry {
  const problems: string[] = []
  const byId = new Map<number, ElementDef>()
  const byName = new Map<string, ElementDef>()
  const tags = new Set<string>()
  const failing = (def: ElementDef) => (message: string) => problems.push(`${def.name}: ${message}`)

  for (const def of defs) {
    const fail = failing(def)

    if (def.id === EMPTY || def.id === WALL) {
      fail(`id ${def.id} is reserved by the engine`)
    } else if (!Number.isInteger(def.id) || def.id < 1 || def.id > 254) {
      fail(`id ${def.id} must be an integer in [1, 254]`)
    } else if (byId.has(def.id)) {
      fail(`duplicate id ${def.id}`)
    } else {
      byId.set(def.id, def)
    }

    if (byName.has(def.name) || def.name === empty.name || def.name === wall.name) {
      fail(`duplicate name ${def.name}`)
    } else {
      byName.set(def.name, def)
    }

    if (def.colours.length === 0) fail('needs at least one colour')
    // The renderer folds the colours into a fixed variant window and picks
    // between them with the low bits of `rb`. A colour past the last slot would
    // simply never be drawn, so say so at boot rather than never.
    if (def.colours.length > VARIANT_SLOTS) {
      fail(`may declare at most ${VARIANT_SLOTS} colours — one per variant slot`)
    }
    for (const colour of def.colours) {
      if (!HEX.test(colour)) fail(`colour ${colour} is not #rrggbb`)
    }

    if (def.hardness !== undefined && !(def.hardness >= 0)) {
      fail('hardness must be a non-negative number')
    }

    for (const tag of def.tags) tags.add(tag)
    checkArchetype(def.archetype, fail)
  }

  // Cross-references resolve against the finished name table, so definition
  // order in the roster does not matter.
  for (const def of defs) {
    const { lifetime } = def
    if (!lifetime) continue
    const fail = failing(def)

    if (!(lifetime.ticks > 0)) fail('lifetime.ticks must be positive')
    if (lifetime.jitter !== undefined && !(lifetime.jitter >= 0)) {
      fail('lifetime.jitter must be non-negative')
    }
    // The countdown lives in one byte, so a longer life is not a long life —
    // it is a silently clamped one. Say so at boot rather than at runtime.
    if (lifetime.ticks + (lifetime.jitter ?? 0) > MAX_LIFETIME_TICKS) {
      fail(`lifetime.ticks + jitter must not exceed ${MAX_LIFETIME_TICKS} — it lives in one byte`)
    }
    if (lifetime.becomes !== null && !byName.has(lifetime.becomes)) {
      fail(`lifetime.becomes names unknown element ${lifetime.becomes}`)
    }
  }

  reactions.forEach((row, i) => {
    const where = `reaction ${i} (${row.a} + ${row.b})`
    for (const side of [row.a, row.b]) {
      if (!byName.has(side) && !tags.has(side)) {
        problems.push(`${where}: ${side} is neither an element nor a tag`)
      }
    }
    for (const product of [row.aBecomes, row.bBecomes]) {
      if (product !== null && !byName.has(product)) {
        problems.push(`${where}: becomes unknown element ${product}`)
      }
    }
    if (!(row.p > 0 && row.p <= 1)) {
      problems.push(`${where}: probability must be in (0, 1]`)
    }
    if (row.maxHardness !== undefined && !(row.maxHardness >= 0)) {
      problems.push(`${where}: maxHardness must be non-negative`)
    }
  })

  if (problems.length > 0) {
    throw new Error(`invalid element registry:\n  ${problems.join('\n  ')}`)
  }

  byId.set(EMPTY, empty)
  byId.set(WALL, wall)

  const tagsById = new Map<number, ReadonlySet<string>>()
  // The hot lookups are id-keyed, and an id is a byte, so each one is a flat
  // 256-slot array rather than a hash. `hasDensity` keeps "density 0" apart
  // from "no density" — a static element has none, and `canDisplace` needs the
  // difference.
  const defById = new Array<ElementDef | undefined>(SPECIES_SLOTS).fill(undefined)
  const densityById = new Float64Array(SPECIES_SLOTS)
  const hasDensity = new Uint8Array(SPECIES_SLOTS)
  for (const [id, def] of byId) {
    tagsById.set(id, new Set(def.tags))
    defById[id] = def
    const density = densityOf(def.archetype)
    if (density !== undefined) {
      densityById[id] = density
      hasDensity[id] = 1
    }
  }

  const pairs = resolvePairs(defs, byName, reactions)
  const lifetimes = resolveLifetimes(defs, byName)

  const roster = [...defs]

  return {
    get: (id) => defById[id],
    all: () => roster,
    has: (id, tag) => tagsById.get(id)?.has(tag) ?? false,
    density: (id) => (hasDensity[id] === 1 ? densityById[id] : undefined),
    reactionFor: (a, b) => {
      const slot = pairs.index[pairKey(a, b)] ?? NO_REACTION
      return slot === NO_REACTION ? undefined : pairs.list[slot]
    },
    lifetimeOf: (id) => lifetimes[id],
  }
}
