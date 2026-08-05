import { EMPTY, WALL } from './elements.ts'
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
): Map<number, Reaction> {
  const pairs = new Map<number, Reaction>()
  const speciesOf = (name: string | null) => (name === null ? EMPTY : byName.get(name)!.id)
  const add = (a: number, b: number, reaction: Reaction) => {
    const key = pairKey(a, b)
    if (!pairs.has(key)) pairs.set(key, reaction)
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

  return pairs
}

function resolveLifetimes(
  defs: readonly ElementDef[],
  byName: ByName,
): Map<number, ResolvedLifetime> {
  const lifetimes = new Map<number, ResolvedLifetime>()
  for (const def of defs) {
    const { lifetime } = def
    if (!lifetime) continue
    lifetimes.set(def.id, {
      ticks: lifetime.ticks,
      jitter: lifetime.jitter ?? 0,
      becomes: lifetime.becomes === null ? EMPTY : byName.get(lifetime.becomes)!.id,
    })
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
  const densityById = new Map<number, number | undefined>()
  for (const [id, def] of byId) {
    tagsById.set(id, new Set(def.tags))
    densityById.set(id, densityOf(def.archetype))
  }

  const pairs = resolvePairs(defs, byName, reactions)
  const lifetimes = resolveLifetimes(defs, byName)

  return {
    get: (id) => byId.get(id),
    has: (id, tag) => tagsById.get(id)?.has(tag) ?? false,
    density: (id) => densityById.get(id),
    reactionFor: (a, b) => pairs.get(pairKey(a, b)),
    lifetimeOf: (id) => lifetimes.get(id),
  }
}
