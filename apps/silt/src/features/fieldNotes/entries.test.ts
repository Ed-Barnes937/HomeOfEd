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

/** Spec §1: the five edges that master mud, as the sim reports them. Pinned as a
 * literal so the fixture fails loudly if the roster changes what "mastering
 * mud" costs. */
const MUD_KEYS = [
  'react:dirt+water',
  'react:ash+water',
  'react:fire+mud',
  'react:lava+mud',
  'react:mud+seed',
  'react:mud+petal',
]

/** The same six as the chart names them: the petal's is charted under flower. */
const CHARTED_MUD_KEYS = [
  'react:dirt+water',
  'react:ash+water',
  'react:fire+mud',
  'react:lava+mud',
  'react:mud+seed',
  'react:flower+mud',
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
      witnessedKey({ kind: 'germinate', a: 'moss' }),
      witnessedKey({ kind: 'germinate', a: 'sprout' }),
      witnessedKey({ kind: 'raise', a: 'sprout' }),
      witnessedKey({ kind: 'bloom', a: 'tip' }),
    ]

    expect(witnessed).toEqual([
      'react:lava+water',
      'react:lava+water',
      'decay:fire',
      'grow:moss',
      'germinate:moss',
      'germinate:sprout',
      'raise:sprout',
      'bloom:tip',
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

describe('charted grouping (ticket 08)', () => {
  test('a bookkeeping species is never a node: buried is what a seed does in mud', () => {
    for (const species of ['buried', 'sprout', 'tip', 'stalk', 'petal']) {
      expect(notes.elements).not.toContain(species)
      expect(notes.entriesFor(species)).toEqual([])
    }
    expect(notes.elements).toContain('seed')
    expect(notes.elements).toContain('flower')
  })

  test('every raw edge reaches exactly one charted entry - no orphans, no doubles', () => {
    const raw = notes.witnessKeys
    expect(new Set(raw).size).toBe(raw.length)
    // The ungrouped graph's own count: nothing was dropped on the way in.
    expect(raw).toHaveLength(58)
    for (const key of raw) expect(notes.get(key)).toBeDefined()
    // And every charted entry is backed by at least one of them.
    for (const entry of notes.all) {
      expect(entry.sources.length).toBeGreaterThan(0)
      for (const source of entry.sources) expect(raw).toContain(source.key)
    }
  })

  test('one charted entry absorbs the raw edges of every part of the plant', () => {
    const lava = notes.get('react:flower+lava')
    expect(lava?.sources.map((source) => source.key).toSorted()).toEqual([
      'react:flower+lava',
      'react:lava+sprout',
      'react:lava+stalk',
      'react:lava+tip',
    ])
    // Acid takes the petal too, and the seed's burial joins acid + seed.
    expect(notes.get('react:acid+flower')?.sources).toHaveLength(5)
    expect(notes.get('react:acid+seed')?.sources.map((source) => source.key).toSorted()).toEqual([
      'react:acid+buried',
      'react:acid+seed',
    ])
    // A key a raw edge no longer answers to still names its charted entry.
    expect(notes.get('react:mud+petal')).toBe(notes.get('react:flower+mud'))
  })

  test('a grouped entry is witnessed by any of its raw edges, mastered by all (decision 1)', () => {
    const one = new Set(['react:lava+stalk'])
    expect(notes.isWitnessed('react:flower+lava', one)).toBe(true)
    // The charted entry answers to the raw key it was reported under, too.
    expect(notes.isWitnessed('react:lava+stalk', one)).toBe(true)
    expect(notes.derive(one).mastered.has('flower')).toBe(false)

    const every = new Set(notes.witnessKeysFor('flower'))
    expect(notes.derive(every).mastered.has('flower')).toBe(true)
    expect(notes.derive(new Set([...every].slice(1))).mastered.has('flower')).toBe(false)
  })

  test('witnessing one part discovers what that part makes, and nothing its siblings do', () => {
    // fire + stalk leaves fire; fire + sprout leaves steam. One charted entry,
    // but discovery stays what the sim actually performed (spec §1).
    const entry = notes.get('react:fire+flower')!
    expect([...entry.products].toSorted()).toEqual(['fire', 'steam'])
    expect(notes.derive(new Set(['react:fire+stalk'])).discovered.has('steam')).toBe(false)
    expect(notes.derive(new Set(['react:fire+sprout'])).discovered.has('steam')).toBe(true)
  })

  test('the plant chain stays a story: germinate, raise and bloom keep their own entries', () => {
    // Decision 2 - the stages chart under flower rather than dropping out as
    // self-loops, so the life cycle is still there to be found one step at a time.
    expect(notes.get('germinate:flower')?.sources.map((source) => source.key)).toEqual([
      'germinate:sprout',
    ])
    expect(notes.get('raise:flower')?.sources.map((source) => source.key)).toEqual(['raise:sprout'])
    expect(notes.get('bloom:flower')?.sources.map((source) => source.key)).toEqual(['bloom:tip'])
    expect(notes.get('raise:flower')?.reagents).toEqual(['flower'])
    expect(notes.get('raise:flower')?.products).toEqual(['flower'])
  })

  test("a charted node's entries are the raw ones its species collected", () => {
    // The flower's ring: four reactions, its decay, and the three stages.
    expect(notes.entriesFor('flower')).toEqual([
      'react:flower+water',
      'react:flower+lava',
      'react:fire+flower',
      'react:acid+flower',
      'react:flower+mud',
      'decay:flower',
      'germinate:flower',
      'raise:flower',
      'bloom:flower',
    ])
  })
})

describe('involves()', () => {
  test("today's totals: an element's entries are its reagent and product edges", () => {
    // Eleven from ticket 07, which made water a reagent of the soaked
    // germination; ten since ticket 16 removed the `acid + water` row.
    expect(notes.entriesFor('water')).toHaveLength(10)
    expect(notes.entriesFor('mud')).toHaveLength(6)
    // Eighteen since ticket 08 folded the plant's parts into one flower: lava's
    // and fire's four stage spokes each became one.
    expect(notes.entriesFor('fire')).toHaveLength(18)
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
    expect([...notes.entriesFor('mud')].sort()).toEqual([...CHARTED_MUD_KEYS].sort())
    // And the raw edges behind them are still the six the sim reports: charting
    // renames an entry, it never adds or drops one.
    expect([...notes.witnessKeysFor('mud')].sort()).toEqual([...MUD_KEYS].sort())
  })
})

describe('totals', () => {
  test('46 charted entries today: 36 reactions, 4 productive decays, 2 growth, 4 hook edges', () => {
    const kinds = (kind: Entry['kind']) => notes.all.filter((entry) => entry.kind === kind)
    // Thirty-six: the graph's 47 raw pairs (48 less the acid + water row,
    // ticket 16), less the three stage spokes lava and fire each grew, the
    // four acid grew, and the burial that folded into acid + seed (ticket 08).
    expect(kinds('react')).toHaveLength(36)
    // The flower's decay is productive twice over: it leaves a seed and its
    // death drop throws petals - one entry, two products.
    expect(kinds('decay')).toHaveLength(4)
    expect(kinds('grow')).toHaveLength(2)
    // The hook transmutations (ticket 07): two germinations, the raise, the bloom.
    expect(kinds('germinate')).toHaveLength(2)
    expect(kinds('raise')).toHaveLength(1)
    expect(kinds('bloom')).toHaveLength(1)
    expect(notes.all).toHaveLength(46)
  })

  test('every hook-born element is the product of a hook edge (spec §3 restored)', () => {
    // The life epic's five arrived undiscoverable (spec decision 10, interim);
    // ticket 07 charts the hooks, so each now has a producing entry - and since
    // ticket 08 the plant's parts are charted as the one flower they make up.
    const producers = (name: string) =>
      notes.entriesFor(name).filter((key) => notes.get(key)!.products.includes(name))
    expect(producers('moss')).toContain('germinate:moss')
    expect(producers('flower')).toContain('germinate:flower')
    // And so does everything else that is not pre-known: the premise itself.
    for (const name of notes.elements) {
      if (notes.preKnown.includes(name)) continue
      expect(producers(name).length, `${name} has no producing entry`).toBeGreaterThan(0)
    }
  })

  test('20 charted elements today, the rail among them pre-known', () => {
    // Twenty since ticket 08: the roster's 25 species, less the five the chart
    // names as the seed and the flower they belong to.
    expect(notes.elements).toHaveLength(20)
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

  test('every element has a tier: no producer-less element is left (ticket 07)', () => {
    // The premise the picker's removed fallback leans on (spec §3 restored):
    // every discoverable element is the product of at least one edge, so a
    // depth is always computable.
    for (const name of notes.elements) expect(notes.tierOf(name)).toBeDefined()
  })

  test('a non-pre-known element sits one past the deepest reagent of its shallowest recipe', () => {
    for (const name of notes.elements) {
      if (notes.preKnown.includes(name)) continue
      const recipes = notes.all
        .filter((entry) => entry.products.includes(name))
        .map((entry) => 1 + Math.max(...entry.reagents.map((r) => notes.tierOf(r) ?? Infinity)))
      expect(notes.tierOf(name)).toBe(Math.min(...recipes))
    }
  })

  test("regression fixture for today's roster", () => {
    // Post-trim: mud is dirt + water's product, so it sits at tier 1. Charting
    // buried as the seed it is (ticket 08) shortens the plant chain to what the
    // player does: a seed in the ground germinates, so moss and the flower are
    // one step off the rail, and vine - grown off moss - is two, beside ash.
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
    expect(byTier.get(1)).toEqual([
      'obsidian',
      'smoke',
      'steam',
      'sulphur',
      'mud',
      'moss',
      'ember',
      'flower',
    ])
    expect(byTier.get(2)).toEqual(['vine', 'ash'])
    expect(byTier.get(undefined)).toBeUndefined()
  })

  test('a deeper chain pushes its product deeper (structure, not the table)', () => {
    // Whatever the roster, ember comes from wood + fire and ash comes from ember,
    // so ash is strictly deeper than ember; vine is grown on moss, so it is
    // deeper than moss.
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

  // The retired key by name (ticket 16). A player who witnessed `acid + water`
  // before the row was removed still has it on disk, so the promise above is not
  // hypothetical for them: it is the one key the roster is known to have dropped.
  test('a retired edge is carried, not counted: react:acid+water is inert', () => {
    expect(notes.get('react:acid+water')).toBeUndefined()
    expect(notes.keys).not.toContain('react:acid+water')

    const derived = notes.derive(new Set([...MUD_KEYS, 'react:acid+water']))
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
    // The raw keys, because that is what a witnessed set holds: the store keeps
    // what the sim reported, and the grouping is derived over it (ticket 08).
    const derived = notes.derive(new Set(notes.witnessKeys))
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
      hooks: [],
      chartAs: new Map(),
    })

    expect(custom.keys).toEqual(['react:alpha+beta', 'decay:gamma'])
    expect(custom.entriesFor('gamma')).toEqual(['react:alpha+beta', 'decay:gamma'])
    expect(custom.tierOf('alpha')).toBe(0)
    expect(custom.tierOf('gamma')).toBe(1)
    expect(custom.tierOf('delta')).toBe(2)
    expect(custom.derive(new Set(['decay:gamma'])).discovered.has('delta')).toBe(true)
  })

  test('a graph that charts one element as another folds its edges into one entry', () => {
    // The mechanism in miniature, away from the live roster: gamma is delta's
    // bookkeeping half, so the two reactions become one entry with two sources.
    const custom = buildEntryIndex({
      nodes: [
        { id: 1, name: 'alpha', paintable: true },
        { id: 2, name: 'gamma', paintable: false },
        { id: 3, name: 'delta', paintable: false },
      ],
      reactions: [
        { a: 'alpha', b: 'gamma', p: 1, aBecomes: 'empty', bBecomes: 'empty', source: 'test' },
        { a: 'alpha', b: 'delta', p: 1, aBecomes: 'empty', bBecomes: 'gamma', source: 'test' },
      ],
      decays: [],
      growth: [],
      hooks: [],
      chartAs: new Map([['gamma', 'delta']]),
    })

    expect(custom.elements).toEqual(['alpha', 'delta'])
    expect(custom.keys).toEqual(['react:alpha+delta'])
    expect(custom.witnessKeys).toEqual(['react:alpha+gamma', 'react:alpha+delta'])
    // Witnessed by either raw edge; mastered only by both.
    expect(custom.isWitnessed('react:alpha+delta', new Set(['react:alpha+gamma']))).toBe(true)
    expect(custom.derive(new Set(['react:alpha+gamma'])).mastered.has('delta')).toBe(false)
    expect(custom.derive(new Set(custom.witnessKeys)).mastered.has('delta')).toBe(true)
    // The entry says what the pair can leave; each source says what its own raw
    // edge left, which is what discovery counts.
    const entry = custom.get('react:alpha+gamma')
    expect(entry).toBe(custom.get('react:alpha+delta'))
    expect(entry?.products).toEqual(['delta'])
    expect(entry?.sources.map((source) => source.products)).toEqual([[], ['delta']])
    expect(custom.derive(new Set(['react:alpha+gamma'])).discovered.has('delta')).toBe(false)
  })

  test('the memoized default index is the live graph, built once', () => {
    expect(entryIndex()).toBe(notes)
    expect(notes.keys).toEqual(buildEntryIndex(deriveInteractionGraph()).keys)
  })
})
