import { EMPTY, WALL } from './elements.ts'
import type { Archetype, ElementDef, ReactionRow } from './types.ts'

export interface ElementRegistry {
  /** `undefined` for ids nothing is registered under. */
  get(id: number): ElementDef | undefined
  has(id: number, tag: string): boolean
  /** `undefined` for archetypes that cannot be displaced (static, wall). */
  density(id: number): number | undefined
  readonly reactions: readonly ReactionRow[]
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
  return archetype.kind === 'powder' ? archetype.density : undefined
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
    default: {
      const exhaustive: never = archetype
      fail(`unknown archetype ${JSON.stringify(exhaustive)}`)
    }
  }
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

  return {
    get: (id) => byId.get(id),
    has: (id, tag) => tagsById.get(id)?.has(tag) ?? false,
    density: (id) => densityById.get(id),
    reactions,
  }
}
