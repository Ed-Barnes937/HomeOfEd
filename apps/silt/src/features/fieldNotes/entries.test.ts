import { describe, expect, test } from 'vitest'
import { deriveInteractionGraph } from '../../docs/interactionGraph.ts'
import {
  UNLOCKABLE_NAMES,
  buildEntryIndex,
  decayKey,
  entryIndex,
  growthKey,
  reactionKey,
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
    expect(notes.entriesFor('water')).toHaveLength(9)
    expect(notes.entriesFor('mud')).toHaveLength(5)
    expect(notes.entriesFor('fire')).toHaveLength(16)
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

  test("mud's entries are the five the spec names", () => {
    expect([...notes.entriesFor('mud')].sort()).toEqual([...MUD_KEYS].sort())
  })
})

describe('totals', () => {
  test('37 entries today: 32 reaction pairs, 3 productive decays, 2 growth edges', () => {
    const kinds = (kind: Entry['kind']) => notes.all.filter((entry) => entry.kind === kind)
    expect(kinds('react')).toHaveLength(32)
    expect(kinds('decay')).toHaveLength(3)
    expect(kinds('grow')).toHaveLength(2)
    expect(notes.all).toHaveLength(37)
  })

  test('19 elements today, the rail among them pre-known', () => {
    expect(notes.elements).toHaveLength(19)
    // 11 until ticket 04 trims mud out of `PAINTABLE_IDS`; read at runtime, so
    // this module needs no edit when it does.
    expect(notes.preKnown).toHaveLength(11)
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
      expect(tier).toBeDefined()
      const recipes = notes.all
        .filter((entry) => entry.products.includes(name))
        .map((entry) => 1 + Math.max(...entry.reagents.map((r) => notes.tierOf(r) ?? Infinity)))
      expect(tier).toBe(Math.min(...recipes))
    }
  })

  test("regression fixture for today's roster", () => {
    // mud is still in `PAINTABLE_IDS`, so it is tier 0 here; ticket 04 trims the
    // rail and mud becomes tier 1, moss 2 and vine 3 (spec §6).
    const byTier = new Map<number, string[]>()
    for (const name of notes.elements) {
      const tier = notes.tierOf(name)!
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
      'mud',
      'seed',
    ])
    expect(byTier.get(1)).toEqual(['obsidian', 'smoke', 'steam', 'sulphur', 'moss', 'ember'])
    expect(byTier.get(2)).toEqual(['vine', 'ash'])
    expect(byTier.get(3)).toBeUndefined()
  })

  test('a deeper chain pushes its product deeper (structure, not the table)', () => {
    // Whatever the roster, ember comes from wood + fire and ash comes from ember,
    // so ash is strictly deeper than ember.
    expect(notes.tierOf('ash')!).toBeGreaterThan(notes.tierOf('ember')!)
    expect(notes.tierOf('vine')!).toBeGreaterThan(notes.tierOf('moss')!)
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

  test("mud's full five keys unlock mud; any four do not", () => {
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
