import { describe, expect, test } from 'vitest'
import { deriveInteractionGraph } from '../../docs/interactionGraph.ts'
import {
  UNLOCKABLE_NAMES,
  buildEntryIndex,
  decayKey,
  entryIndex,
  growthKey,
  reactionKey,
  witnessedKey,
  type Entry,
} from './entries.ts'

const notes = entryIndex()

/** Spec §1: the five edges that master mud. Pinned as a literal so the fixture
 * fails loudly if the roster changes what "mastering mud" costs. */
const MUD_KEYS = [
  'react:dirt+water',
  'react:ash+water',
  'react:fire+mud',
  'react:lava+mud',
  'react:mud+seed',
  'react:mud+petal',
]

describe('canonical edge keys', () => {
  test('a reaction key sorts its two names, whichever order it is asked in', () => {
    expect(reactionKey('wood', 'acid')).toBe('react:acid+wood')
    expect(reactionKey('acid', 'wood')).toBe('react:acid+wood')
  })

  test('decay and growth keys name their single subject', () => {
    expect(decayKey('fire')).toBe('decay:fire')
    expect(growthKey('moss')).toBe('grow:moss')
  })

  test('a witnessed event maps onto the key of the entry it fired', () => {
    // The sim reports the interaction; this is where it becomes an entry. Each
    // key below is one the roster actually holds, so a drifting format shows up
    // as an entry that cannot be found rather than as a silent miss.
    const witnessed = [
      witnessedKey({ kind: 'react', a: 'lava', b: 'water' }),
      witnessedKey({ kind: 'react', a: 'water', b: 'lava' }),
      witnessedKey({ kind: 'decay', a: 'fire' }),
      witnessedKey({ kind: 'grow', a: 'moss' }),
    ]

    expect(witnessed).toEqual([
      'react:lava+water',
      'react:lava+water',
      'decay:fire',
      'grow:moss',
    ])
    for (const key of witnessed) expect(notes.get(key)).toBeDefined()
  })

  test('a fade decay is not an entry: smoke leaves nothing behind', () => {
    expect(notes.get('decay:smoke')).toBeUndefined()
    expect(notes.keys).not.toContain('decay:smoke')
    expect(notes.keys).toContain('decay:fire')
    expect(notes.keys).toContain('decay:steam')
    expect(notes.keys).toContain('decay:ember')
  })

  test('every entry key is unique and every entry names at least one reagent', () => {
    expect(new Set(notes.keys).size).toBe(notes.keys.length)
    for (const entry of notes.all) expect(entry.reagents.length).toBeGreaterThan(0)
  })

  test('`empty` is never an element: a cleared cell is absent, not a product', () => {
    for (const entry of notes.all) expect(entry.products).not.toContain('empty')
    expect(notes.entriesFor('empty')).toEqual([])
  })
})

describe('involves()', () => {
  test("today's totals: an element's entries are its reagent and product edges", () => {
    expect(notes.entriesFor('water')).toHaveLength(10)
    expect(notes.entriesFor('mud')).toHaveLength(6)
    expect(notes.entriesFor('fire')).toHaveLength(24)
  })

  test('stone has exactly the one edge that makes it', () => {
    expect(notes.entriesFor('stone')).toEqual(['react:lava+mud'])
  })

  test('a product-only element still has entries (splitting the predicate empties the ring)', () => {
    expect(notes.entriesFor('obsidian')).toEqual(['react:lava+water'])
    for (const name of ['smoke', 'steam', 'sulphur', 'moss', 'vine', 'ember', 'ash']) {
      expect(notes.entriesFor(name).length).toBeGreaterThan(0)
    }
  })

  test('involves() agrees with entriesFor() for every element and every key', () => {
    for (const name of notes.elements) {
      const listed = new Set(notes.entriesFor(name))
      for (const key of notes.keys) expect(notes.involves(key, name)).toBe(listed.has(key))
    }
  })

  test('an unknown key involves nothing', () => {
    expect(notes.involves('react:unobtanium+water', 'water')).toBe(false)
  })

  test("mud's entries are the six the registry derives (the spec's five plus mud + petal)", () => {
    expect([...notes.entriesFor('mud')].sort()).toEqual([...MUD_KEYS].sort())
  })
})

describe('totals', () => {
  test('54 entries today: 48 reaction pairs, 4 productive decays, 2 growth edges', () => {
    const kinds = (kind: Entry['kind']) => notes.all.filter((entry) => entry.kind === kind)
    expect(kinds('react')).toHaveLength(48)
    // The flower's decay is productive twice over: it leaves a seed and its
    // death drop throws petals - one entry, two products.
    expect(kinds('decay')).toHaveLength(4)
    expect(kinds('grow')).toHaveLength(2)
    expect(notes.all).toHaveLength(54)
  })

  test('25 elements today, the rail among them pre-known', () => {
    expect(notes.elements).toHaveLength(25)
    // Ten since the rail trim took mud out of `PAINTABLE_IDS` (spec §9.5) - mud
    // is now earned back by mastering it, and an earned unlock is not pre-known.
    expect(notes.preKnown).toHaveLength(10)
    for (const name of notes.preKnown) expect(notes.elements).toContain(name)
  })
})

describe('tiers', () => {
  test('every pre-known element is tier 0', () => {
    for (const name of notes.preKnown) expect(notes.tierOf(name)).toBe(0)
  })

  test('a non-pre-known element sits one past the deepest reagent of its shallowest recipe', () => {
    for (const name of notes.elements) {
      if (notes.preKnown.includes(name)) continue
      const tier = notes.tierOf(name)
      if (tier === undefined) continue // the hook-born, until ticket 07 charts the hooks
      const recipes = notes.all
        .filter((entry) => entry.products.includes(name))
        .map((entry) => 1 + Math.max(...entry.reagents.map((r) => notes.tierOf(r) ?? Infinity)))
      expect(tier).toBe(Math.min(...recipes))
    }
  })

  test('the untiered are exactly the hook-born and their downstream (ticket 07 retires this)', () => {
    // moss, sprout, tip, stalk and flower are made by onTick hooks the graph
    // does not chart, so no entry produces them and no depth can be computed;
    // vine and petal have producing entries whose reagents are those five, so
    // their depth cannot resolve either. Ticket 07 charts the hooks and this
    // fixture should then fail - delete it and pin the real tiers.
    const untiered = notes.elements.filter((name) => notes.tierOf(name) === undefined)
    expect(untiered.toSorted()).toEqual([
      'flower',
      'moss',
      'petal',
      'sprout',
      'stalk',
      'tip',
      'vine',
    ])
  })

  test("regression fixture for today's roster", () => {
    // Post-trim: mud is dirt + water's product, so it sits at tier 1; the life
    // epic's seed + mud row now buries the seed, so buried joins ash at 2 and
    // moss (hook-germinated, uncharted until ticket 07) has no tier at all.
    const byTier = new Map<number | undefined, string[]>()
    for (const name of notes.elements) {
      const tier = notes.tierOf(name)
      byTier.set(tier, [...(byTier.get(tier) ?? []), name])
    }
    expect(byTier.get(0)).toEqual([
      'dirt',
      'sand',
      'water',
      'lava',
      'wood',
      'oil',
      'fire',
      'acid',
      'stone',
      'seed',
    ])
    expect(byTier.get(1)).toEqual(['obsidian', 'smoke', 'steam', 'sulphur', 'mud', 'ember'])
    expect(byTier.get(2)).toEqual(['ash', 'buried'])
    expect(byTier.get(3)).toBeUndefined()
  })

  test('a deeper chain pushes its product deeper (structure, not the table)', () => {
    // Whatever the roster, ember comes from wood + fire and ash comes from ember,
    // so ash is strictly deeper than ember; buried needs mud, which needs water.
    expect(notes.tierOf('ash')!).toBeGreaterThan(notes.tierOf('ember')!)
    expect(notes.tierOf('buried')!).toBeGreaterThan(notes.tierOf('mud')!)
  })
})

describe('derivations from a witnessed-key set', () => {
  test('an empty set knows exactly the pre-knowns, masters nothing, unlocks nothing', () => {
    const derived = notes.derive(new Set())
    expect([...derived.discovered].sort()).toEqual([...notes.preKnown].sort())
    expect([...derived.mastered]).toEqual([])
    expect(derived.unlocked).toEqual([])
  })

  test('a witnessed edge discovers its products and nothing else', () => {
    const derived = notes.derive(new Set(['react:lava+water']))
    expect([...derived.discovered].sort()).toEqual(
      [...new Set([...notes.preKnown, 'steam', 'obsidian'])].sort(),
    )
    expect(notes.derive(new Set(['react:dirt+water'])).discovered.has('mud')).toBe(true)
  })

  test('a zero-product edge discovers nothing', () => {
    const derived = notes.derive(new Set(['react:acid+dirt']))
    expect([...derived.discovered].sort()).toEqual([...notes.preKnown].sort())
  })

  test("mud's full six keys unlock mud; any five do not", () => {
    expect(UNLOCKABLE_NAMES).toEqual(['mud'])
    const full = notes.derive(new Set(MUD_KEYS))
    expect(full.mastered.has('mud')).toBe(true)
    expect(full.unlocked).toEqual(['mud'])

    for (const omitted of MUD_KEYS) {
      const short = notes.derive(new Set(MUD_KEYS.filter((key) => key !== omitted)))
      expect(short.mastered.has('mud')).toBe(false)
      expect(short.unlocked).toEqual([])
    }
  })

  test('unknown keys are inert, never an error', () => {
    const derived = notes.derive(new Set([...MUD_KEYS, 'react:unobtanium+water', 'nonsense']))
    expect(derived.unlocked).toEqual(['mud'])
    expect([...derived.discovered].sort()).toEqual(
      [...notes.derive(new Set(MUD_KEYS)).discovered].sort(),
    )
  })

  test('mastering an element needs every entry that involves it, product edges included', () => {
    const obsidian = notes.entriesFor('obsidian')
    expect(notes.derive(new Set(obsidian)).mastered.has('obsidian')).toBe(true)
    expect(notes.derive(new Set()).mastered.has('obsidian')).toBe(false)
  })

  test('witnessing everything masters every element', () => {
    const derived = notes.derive(new Set(notes.keys))
    expect([...derived.mastered].sort()).toEqual([...notes.elements].sort())
    expect(derived.unlocked).toEqual([...UNLOCKABLE_NAMES])
  })
})

describe('buildEntryIndex()', () => {
  test('derives against the graph it is given, not the live registry', () => {
    const custom = buildEntryIndex({
      nodes: [
        { id: 1, name: 'alpha', paintable: true },
        { id: 2, name: 'beta', paintable: true },
        { id: 3, name: 'gamma', paintable: false },
        { id: 4, name: 'delta', paintable: false },
      ],
      reactions: [
        { a: 'beta', b: 'alpha', p: 1, aBecomes: 'gamma', bBecomes: 'empty', source: 'test' },
      ],
      decays: [
        { from: 'gamma', becomes: 'delta', minTicks: 1, maxTicks: 1 },
        { from: 'delta', becomes: 'empty', minTicks: 1, maxTicks: 1 },
      ],
      growth: [],
    })

    expect(custom.keys).toEqual(['react:alpha+beta', 'decay:gamma'])
    expect(custom.entriesFor('gamma')).toEqual(['react:alpha+beta', 'decay:gamma'])
    expect(custom.tierOf('alpha')).toBe(0)
    expect(custom.tierOf('gamma')).toBe(1)
    expect(custom.tierOf('delta')).toBe(2)
    expect(custom.derive(new Set(['decay:gamma'])).discovered.has('delta')).toBe(true)
  })

  test('the memoized default index is the live graph, built once', () => {
    expect(entryIndex()).toBe(notes)
    expect(notes.keys).toEqual(buildEntryIndex(deriveInteractionGraph()).keys)
  })
})
