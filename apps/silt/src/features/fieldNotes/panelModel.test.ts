import { describe, expect, test } from 'vitest'

import { createRegistry, v1Elements, v1Reactions } from '../../sim/index.ts'
import { elementTags } from './elementAppearance.ts'
import { entryIndex } from './entries.ts'
import { fieldNotesView } from './fieldNotesView.ts'
import type { Progress } from './fieldNotesStore.ts'
import {
  groupRing,
  HIDDEN_NAME,
  LEGEND_RULES,
  legendRows,
  pickerRows,
  ringFor,
  type Spoke,
} from './panelModel.ts'
import { RING_CAPACITY } from './ringGeometry.ts'

const notes = entryIndex()
const tags = elementTags(createRegistry(v1Elements, v1Reactions))

/** A player who has witnessed exactly `edges`, with nothing left unreviewed. */
function progressOf(...edges: string[]): Progress {
  return { edges, reviewed: edges.length }
}

function viewOf(...edges: string[]) {
  return fieldNotesView(progressOf(...edges))
}

function rowFor(name: string, ...edges: string[]) {
  const row = pickerRows(viewOf(...edges)).find((candidate) => candidate.name === name)
  if (!row) throw new Error(`no picker row for ${name}`)
  return row
}

describe('picker ordering', () => {
  test('tier order, then rail order inside a tier', () => {
    expect(pickerRows(viewOf()).map((row) => row.name)).toEqual([
      // Tier 0: the base rail, in rail order.
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
      // Then each tier of products, roster order inside it. Since ticket 08 the
      // plant is one node - buried is charted as the seed it is, so germination
      // is one step off the rail and the whole chain shortens with it: moss and
      // flower at 1, and vine, grown on moss, at 2 beside ash.
      'obsidian',
      'smoke',
      'steam',
      'sulphur',
      'mud',
      'moss',
      'ember',
      'flower',
      'vine',
      'ash',
    ])
  })

  test('a species the chart does not name gets no row at all (ticket 08)', () => {
    const names = pickerRows(viewOf()).map((row) => row.name)
    for (const species of ['buried', 'sprout', 'tip', 'stalk', 'petal']) {
      expect(names).not.toContain(species)
    }
    expect(names).toContain('flower')
    expect(names).toContain('seed')
  })

  test('every element in the roster gets a slot, discovered or not (spec §7)', () => {
    const rows = pickerRows(viewOf())
    expect(rows).toHaveLength(notes.elements.length)
    const tiers = rows.map((row) => row.tier)
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b))
  })
})

describe('picker rows', () => {
  test('an undiscovered row is masked, countless and not selectable (spec §7)', () => {
    const row = rowFor('obsidian')
    expect(row.discovered).toBe(false)
    expect(row.label).toBe(HIDDEN_NAME)
    expect(row.count).toBe('')
    expect(row.mastered).toBe(false)
  })

  test('a discovered row counts the entries that involve it, reagent or product', () => {
    // Water has ten entries - eleven after ticket 07 charted the soaked
    // germination, one fewer since ticket 16 removed `acid + water`; one of them
    // has now been witnessed.
    expect(rowFor('water', 'react:lava+water').count).toBe('1/10')
    expect(rowFor('water').count).toBe('0/10')
  })

  test('a product-only element is discovered by the entry that makes it, and mastered by it', () => {
    const row = rowFor('obsidian', 'react:lava+water')
    expect(row.discovered).toBe(true)
    expect(row.label).toBe('obsidian')
    expect(row.count).toBe('1/1')
    expect(row.mastered).toBe(true)
  })

  test("mud's row states what it costs to unlock, until it is earned (spec §6)", () => {
    expect(rowFor('mud', 'react:dirt+water').count).toBe('1/6 to unlock')
    expect(rowFor('mud', ...notes.witnessKeysFor('mud')).count).toBe('6/6')
  })

  test('every discoverable row states its unlock, not just mud (ticket 14)', () => {
    // Mud stops being special: any charted non-base element joins the rail when
    // mastered, so any discovered one that is not yet mastered says so.
    const steam = rowFor('steam', 'react:lava+water')
    expect(steam.mastered).toBe(false)
    expect(steam.count).toBe(`1/${notes.entriesFor('steam').length} to unlock`)

    // A base element is not unlockable, so its row is a bare count however far
    // along it is - it is in the rail already.
    expect(rowFor('water', 'react:lava+water').count).toBe('1/10')
  })

  test('newly discovered elements are marked until the panel is reviewed', () => {
    const fresh = pickerRows(fieldNotesView({ edges: ['react:lava+water'], reviewed: 0 }))
    const marked = fresh.filter((row) => row.isNew).map((row) => row.name)
    // The two products of the one witnessed entry - never a name the chart hides.
    expect(marked).toEqual(['obsidian', 'steam'])
    expect(pickerRows(viewOf('react:lava+water')).some((row) => row.isNew)).toBe(false)
  })
})

describe('the ring', () => {
  test('only witnessed entries are drawn, and the footer counts the rest (spec §7)', () => {
    const ring = ringFor('water', viewOf('react:lava+water'))
    expect(ring.spokes.map((spoke) => spoke.key)).toEqual(['react:lava+water'])
    expect(ring.seen).toBe(1)
    expect(ring.stillToFind).toBe(9)

    const empty = ringFor('water', viewOf())
    expect(empty.spokes).toEqual([])
    expect(empty.stillToFind).toBe(10)
  })

  test('a spoke resolves the entry products into words and tappable tiles', () => {
    const [spoke] = ringFor('water', viewOf('react:lava+water')).spokes
    expect(spoke?.partner.name).toBe('lava')
    expect(spoke?.outcome).toBe('steam · obsidian')
    expect(spoke?.tiles.map((tile) => tile.name)).toEqual(['steam', 'obsidian'])
    expect(spoke?.tiles.every((tile) => tile.discovered)).toBe(true)
  })

  test('a product of the focused element is not offered as a tile back to itself', () => {
    // fire + sulphur leaves fire on both sides, and `productsOf` collapses the
    // pair to one: the words still say so, but the only tile would lead back to
    // the centre. This case read off `react:acid+water` until that row was
    // removed (ticket 16) - the shape it pins is the roster's, not that row's.
    const [spoke] = ringFor('fire', viewOf('react:fire+sulphur')).spokes
    expect(spoke?.outcome).toBe('fire')
    expect(spoke?.tiles).toEqual([])
  })

  test('a zero-product entry is an entry too, and reads "both consumed" (spec §6)', () => {
    const [spoke] = ringFor('dirt', viewOf('react:acid+dirt')).spokes
    expect(spoke?.partner.name).toBe('acid')
    expect(spoke?.outcome).toBe('both consumed')
    expect(spoke?.tiles).toEqual([])
  })

  test('an arrowhead points into the centre when the pair is what makes it', () => {
    const [spoke] = ringFor('obsidian', viewOf('react:lava+water')).spokes
    expect(spoke?.direction).toBe('in')
    expect(spoke?.outcome).toBe('lava + water')
    expect(spoke?.tiles.map((tile) => tile.name)).toEqual(['lava', 'water'])
    expect(spoke?.partner.name).toBe('lava')
  })

  test('a decay points at its product, and back into the centre from the other end', () => {
    const source = ringFor('fire', viewOf('decay:fire')).spokes[0]
    expect(source?.kind).toBe('decay')
    expect(source?.partner.name).toBe('smoke')
    expect(source?.direction).toBe('out')
    expect(source?.outcome).toBe('smoke')

    const product = ringFor('smoke', viewOf('decay:fire')).spokes[0]
    expect(product?.partner.name).toBe('fire')
    expect(product?.direction).toBe('in')
    expect(product?.outcome).toBe('fire')
  })

  test('a reaction between two reagents carries no arrowhead', () => {
    expect(ringFor('water', viewOf('react:lava+water')).spokes[0]?.direction).toBe('none')
  })

  test('growth is directed too: the edge that makes vine points into vine', () => {
    expect(ringFor('vine', viewOf('grow:moss')).spokes[0]?.direction).toBe('in')
    expect(ringFor('water', viewOf('grow:moss')).spokes[0]?.direction).toBe('out')
  })

  test('a hook edge is directed the same way (ticket 07)', () => {
    // Germination seen from its product points in; seen from a reagent, out.
    expect(ringFor('moss', viewOf('germinate:moss')).spokes[0]?.direction).toBe('in')
    expect(ringFor('water', viewOf('germinate:moss')).spokes[0]?.direction).toBe('out')
    expect(ringFor('flower', viewOf('germinate:sprout')).spokes[0]?.direction).toBe('in')
    expect(ringFor('seed', viewOf('germinate:sprout')).spokes[0]?.direction).toBe('out')
  })

  test("a stage of the plant's own chain carries no arrowhead (ticket 08)", () => {
    // The raise and the bloom happen inside one charted element, so both ends
    // of the arrow would be the centre. The entry is still there to be found -
    // the life cycle stays a story (decision 2) - it just points nowhere.
    const raise = ringFor('flower', viewOf('raise:sprout')).spokes[0]
    expect(raise?.key).toBe('raise:flower')
    expect(raise?.direction).toBe('none')
    expect(raise?.tiles).toEqual([])
    expect(ringFor('flower', viewOf('bloom:tip')).spokes[0]?.direction).toBe('none')

    // The flower's decay leaves a seed, so from the flower it still points out
    // even though its own petals are charted back onto it.
    const decay = ringFor('flower', viewOf('decay:flower')).spokes[0]
    expect(decay?.direction).toBe('out')
    expect(decay?.outcome).toBe('seed · flower')
  })

  test('the centre carries its own mastery, and its name only once discovered', () => {
    expect(ringFor('obsidian', viewOf()).centre).toEqual({
      name: 'obsidian',
      label: HIDDEN_NAME,
      discovered: false,
    })
    expect(ringFor('obsidian', viewOf('react:lava+water')).mastered).toBe(true)
    expect(ringFor('water', viewOf('react:lava+water')).mastered).toBe(false)
  })
})

describe('tag chips (ticket 12)', () => {
  test("the focused element's chips name the sim tags the reaction table keys on", () => {
    // Wood is the whole point of the ticket: "flammable" on wood *is* the hint
    // that fire has business with it.
    expect(ringFor('wood', viewOf(), tags).centre.tags).toEqual(['solid', 'flammable'])
    expect(ringFor('water', viewOf(), tags).centre.tags).toEqual(['liquid'])
  })

  test('chips come out in allowlist order, never in the roster declaration order', () => {
    const shuffled = new Map([['wood', ['flammable', 'solid']]])
    expect(ringFor('wood', viewOf(), shuffled).centre.tags).toEqual(['solid', 'flammable'])
  })

  test('an unknown tag is dropped, never shown raw (the allowlist)', () => {
    const invented = new Map([['wood', ['solid', 'sticky', 'flammable']]])
    expect(ringFor('wood', viewOf(), invented).centre.tags).toEqual(['solid', 'flammable'])
  })

  test('energy is shown: the rail already groups fire under that word', () => {
    expect(ringFor('fire', viewOf(), tags).centre.tags).toEqual(['gas', 'energy'])
  })

  test('a hidden element carries no tags field at all (spec §7)', () => {
    const view = viewOf()
    expect(view.discovered.has('obsidian')).toBe(false)
    expect('tags' in ringFor('obsidian', view, tags).centre).toBe(false)

    // Discovering it is the only thing that turns the chips on.
    expect(ringFor('obsidian', viewOf('react:lava+water'), tags).centre.tags).toEqual([
      'solid',
    ])
  })

  test('chips reach the ring centre only, never a spoke partner or a product tile', () => {
    const [spoke] = ringFor('water', viewOf('react:lava+water'), tags).spokes
    expect(spoke && 'tags' in spoke.partner).toBe(false)
    expect(spoke?.tiles.every((tile) => !('tags' in tile))).toBe(true)
  })

  test('no tag source, no chips: the picker rows and a default ring carry none', () => {
    expect('tags' in ringFor('wood', viewOf()).centre).toBe(false)
    const row = pickerRows(viewOf()).find((candidate) => candidate.name === 'wood')
    expect(row && 'tags' in row).toBe(false)
  })
})

describe('the key (ticket 11)', () => {
  test('every kind the graph draws is in the key, and each of them once', () => {
    const kinds = legendRows().flatMap((row) => row.kinds)
    expect(new Set(kinds)).toEqual(new Set(notes.all.map((entry) => entry.kind)))
    expect(kinds).toHaveLength(new Set(kinds).size)
  })

  test('the kinds drawn with one stroke share its row, in graph order', () => {
    const rows = legendRows()
    // Three strokes today (spec §6): reaction, decay, and the dots every hook
    // shares. A kind with a stroke of its own would be a fourth row for free.
    expect(rows.map((row) => row.stroke)).toEqual(['react', 'decay', 'grow'])
    expect(rows.map((row) => row.label)).toEqual([
      'reaction',
      'decay',
      'growth · germination · raise · bloom',
    ])
  })

  test('a roster without hooks keeps the key to the strokes it actually draws', () => {
    // The list is derived, so a graph missing a kind is simply a shorter key.
    const rows = legendRows({
      ...notes,
      all: notes.all.filter((entry) => entry.kind === 'react' || entry.kind === 'decay'),
    })
    expect(rows.map((row) => row.stroke)).toEqual(['react', 'decay'])
  })

  test('the key names no element at all, hidden or not (spec §7)', () => {
    // Static text about line kinds only - which is what makes the key immune to
    // the spoiler policy rather than merely compliant with it. Substrings count:
    // "long-dashed" would smuggle ash in, and "remember" ember.
    const words = [
      ...legendRows().flatMap((row) => [row.label, row.meaning]),
      ...LEGEND_RULES.map((rule) => rule.text),
    ]
      .join(' ')
      .toLowerCase()
    for (const name of notes.elements) expect(words).not.toContain(name)
  })
})

describe('grouped spokes (ticket 09)', () => {
  /** A player who has witnessed every raw edge in the graph. */
  const everything = viewOf(...notes.witnessKeys)

  /** The stack a grouped spoke draws at its ring point, by name. */
  function stackOf(spoke: Spoke | undefined): string[] {
    return (spoke?.group?.members ?? []).map((member) => member.name)
  }

  test('the ring groups nothing while it fits, however many pairs share a result', () => {
    // Sulphur's seven fit, so its five acid pairs stay five spokes: below the
    // capacity, full fidelity is worth more than tidiness (decision 3).
    const spokes = ringFor('sulphur', everything).spokes
    expect(spokes).toHaveLength(7)
    expect(spokes.every((spoke) => spoke.group === undefined)).toBe(true)
  })

  test('a ring at the capacity exactly does not group; one over does', () => {
    const spokes = ringFor('sulphur', everything).spokes

    expect(groupRing(spokes, 'sulphur', spokes.length)).toEqual(spokes)
    expect(groupRing(spokes, 'sulphur', spokes.length - 1).length).toBeLessThan(spokes.length)
  })

  test("ticket 15's acid rows collapse to one spoke: same verb, same result", () => {
    const spokes = ringFor('sulphur', everything).spokes
    const grouped = groupRing(spokes, 'sulphur', spokes.length - 1)

    // Three verbs-and-results on sulphur's ring: what makes it, what burns it,
    // and what lava does to it.
    expect(grouped).toHaveLength(3)
    const [made] = grouped.filter((spoke) => spoke.direction === 'in')
    expect(made?.group?.seen).toBe(5)
    expect(made?.group?.total).toBe(5)
    expect(stackOf(made)).toEqual(['wood', 'seed', 'moss', 'vine', 'flower'])

    // The grouping key is the verb and the result, not the rows behind them:
    // ticket 15's eight literal `acid + <plant>` rows, the wood one and the
    // buried seed land on five charted entries (ticket 08) and, here, on one
    // spoke. A table refactor into a `[plant]` tag row would move none of this.
    const raw = (made?.group?.members ?? []).flatMap(
      (member) => notes.get(member.key)?.sources ?? [],
    )
    expect(raw).toHaveLength(10)
  })

  test('a group says what its members share, and stacks what they do not', () => {
    const spokes = ringFor('sulphur', everything).spokes
    const [made] = groupRing(spokes, 'sulphur', spokes.length - 1).filter(
      (spoke) => spoke.direction === 'in',
    )

    // Every member is `acid + something`, so acid is the words and the product
    // tile, and the somethings are the stack. Nothing is invented: the ellipsis
    // stands for the stack, which is drawn right beside it.
    expect(made?.outcome).toBe('acid + …')
    expect(made?.tiles.map((tile) => tile.name)).toEqual(['acid'])
    expect(made?.kind).toBe('react')
  })

  test('a lone witnessed pair keeps its own words, and states what it is one of', () => {
    // Grouping must not cost the player a reading of the pair they actually
    // witnessed - with one member there is nothing to elide, so nothing is.
    const view = viewOf('react:acid+wood')
    const spokes = ringFor('sulphur', view).spokes
    const [only] = groupRing(spokes, 'sulphur', 0)

    expect(only?.outcome).toBe('acid + wood')
    expect(stackOf(only)).toEqual(['acid'])
    expect(only?.group).toMatchObject({ seen: 1, total: 5 })
  })

  test('the chip counts pairs, not raw edges: the still-to-find rule, localised', () => {
    const view = viewOf('react:acid+wood', 'react:acid+moss')
    const spokes = ringFor('sulphur', view).spokes
    const [made] = groupRing(spokes, 'sulphur', 0).filter((spoke) => spoke.direction === 'in')

    expect(made?.group).toMatchObject({ seen: 2, total: 5 })
    expect(stackOf(made)).toEqual(['wood', 'moss'])
  })

  test('a member the player has not discovered is a silhouette, counted and unnamed', () => {
    const view = viewOf(
      'react:acid+wood',
      'react:acid+seed',
      'react:acid+moss',
      'react:acid+vine',
      'react:acid+flower',
    )
    const spokes = ringFor('sulphur', view).spokes
    const [made] = groupRing(spokes, 'sulphur', 0)

    // Acid dissolving a plant discovers sulphur, never the plant: three of the
    // five members are elements this player has never seen.
    expect(made?.group?.members.map((member) => member.label)).toEqual([
      'wood',
      'seed',
      HIDDEN_NAME,
      HIDDEN_NAME,
      HIDDEN_NAME,
    ])
    expect(made?.group?.members.map((member) => member.discovered)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ])
    expect(made?.group?.seen).toBe(5)
  })

  test("fire's ring is the one the roster actually crowds, and it groups itself", () => {
    // The ticket's own case: eighteen witnessed spokes, a solid wall of
    // arrowheads at twelve o'clock. Nothing is dropped - the pairs move into
    // the stacks - so the entry count under the ring does not move either.
    const ring = ringFor('fire', everything)
    expect(notes.entriesFor('fire')).toHaveLength(18)
    expect(ring.spokes.length).toBeLessThanOrEqual(RING_CAPACITY)
    expect(ring.seen).toBe(18)
    expect(ring.stillToFind).toBe(0)

    const pairs = ring.spokes.reduce((sum, spoke) => sum + (spoke.group?.seen ?? 1), 0)
    expect(pairs).toBe(18)

    // Six of them are `lava + something -> lava · fire`, and lava is what they
    // share: it stays on the line while the somethings become the stack.
    const [lava] = ring.spokes.filter((spoke) => (spoke.group?.seen ?? 1) > 1 && spoke.direction === 'in')
    expect(lava?.outcome).toBe('lava + …')
    expect(stackOf(lava)).toEqual(['oil', 'sulphur', 'seed', 'moss', 'vine', 'flower'])
  })

  test('a grouped ring is still every witnessed pair, and only witnessed ones', () => {
    const ring = ringFor('fire', everything)
    const keys = ring.spokes.flatMap((spoke) =>
      spoke.group ? spoke.group.members.map((member) => member.key) : [spoke.key],
    )
    expect(new Set(keys)).toEqual(new Set(notes.entriesFor('fire')))
  })
})

describe('the spoiler invariant (spec §7)', () => {
  /**
   * A witnessed entry can still name an element the chart is hiding: a scene
   * saved before the rail trim restores painted mud, and dropping lava on it
   * witnesses `lava + mud` without mud ever having been *discovered*. Nothing
   * the panel renders may name it.
   */
  test('a witnessed entry never names an element that has not been discovered', () => {
    const view = viewOf('react:lava+mud')
    expect(view.discovered.has('mud')).toBe(false)

    const [spoke] = ringFor('stone', view).spokes
    expect(spoke?.outcome).toBe(`lava + ${HIDDEN_NAME}`)
    expect(spoke?.tiles.map((tile) => tile.label)).toEqual(['lava', HIDDEN_NAME])
    expect(spoke?.tiles.map((tile) => tile.discovered)).toEqual([true, false])

    const fromLava = ringFor('lava', view).spokes[0]
    expect(fromLava?.partner.label).toBe(HIDDEN_NAME)
    expect(fromLava?.outcome).toBe('lava · stone')
  })

  test('no rendered word of any ring names an element the player has not discovered', () => {
    // Every element in turn, against a witnessed set that deliberately runs
    // ahead of what has been discovered. Neither entry produces mud, so mud
    // stays hidden while two of its interactions are on the chart.
    const view = viewOf('react:lava+mud', 'react:fire+mud')
    const hidden = notes.elements.filter((name) => !view.discovered.has(name))
    expect(hidden).toContain('mud')

    for (const name of notes.elements) {
      const ring = ringFor(name, view)
      const words = [
        ring.centre.label,
        ...ring.spokes.flatMap((spoke) => [
          spoke.outcome,
          spoke.partner.label,
          ...spoke.tiles.map((tile) => tile.label),
        ]),
      ].join(' ')
      for (const secret of hidden) expect(words).not.toContain(secret)
    }
  })

  test('nor does a grouped one, whose stacks are silhouettes like everything else', () => {
    // Every ring forced to group (capacity 0) against a witnessed set that runs
    // ahead of what has been discovered: the stacks and the elided words are
    // new places a name could reach the DOM, and neither may carry one.
    // Everything witnessed except the edges that would *make* mud, so every
    // ring is full while mud itself has still never been seen.
    const view = viewOf(
      ...notes.all
        .flatMap((entry) => entry.sources)
        .filter((source) => !source.products.includes('mud'))
        .map((source) => source.key),
    )
    const hidden = notes.elements.filter((name) => !view.discovered.has(name))
    expect(hidden).toContain('mud')

    for (const name of notes.elements) {
      const grouped = groupRing(ringFor(name, view).spokes, name, 0)
      const words = grouped
        .flatMap((spoke) => [
          spoke.outcome,
          spoke.partner.label,
          ...spoke.tiles.map((tile) => tile.label),
          ...(spoke.group?.members ?? []).map((member) => member.label),
        ])
        .join(' ')
      for (const secret of hidden) expect(words).not.toContain(secret)
    }
  })
})
