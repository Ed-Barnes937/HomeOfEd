import { describe, expect, test } from 'vitest'

import { entryIndex } from './entries.ts'
import { fieldNotesView } from './fieldNotesView.ts'
import type { Progress } from './fieldNotesStore.ts'
import { HIDDEN_NAME, pickerRows, ringFor } from './panelModel.ts'

const notes = entryIndex()

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
      // Then each tier of products, roster order inside it. The plant chain
      // hangs off buried through the hook edges (ticket 07): germination at 3,
      // what the sprout raises (and vine, grown off moss) at 4, the bloom at 5,
      // the flower's brood at 6.
      'obsidian',
      'smoke',
      'steam',
      'sulphur',
      'mud',
      'ember',
      'ash',
      'buried',
      'moss',
      'sprout',
      'vine',
      'tip',
      'stalk',
      'flower',
      'petal',
    ])
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
    // Water has eleven entries since ticket 07 charted the soaked germination;
    // one of them has now been witnessed.
    expect(rowFor('water', 'react:lava+water').count).toBe('1/11')
    expect(rowFor('water').count).toBe('0/11')
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
    expect(rowFor('mud', ...notes.entriesFor('mud')).count).toBe('6/6')
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
    expect(ring.stillToFind).toBe(10)

    const empty = ringFor('water', viewOf())
    expect(empty.spokes).toEqual([])
    expect(empty.stillToFind).toBe(11)
  })

  test('a spoke resolves the entry products into words and tappable tiles', () => {
    const [spoke] = ringFor('water', viewOf('react:lava+water')).spokes
    expect(spoke?.partner.name).toBe('lava')
    expect(spoke?.outcome).toBe('steam · obsidian')
    expect(spoke?.tiles.map((tile) => tile.name)).toEqual(['steam', 'obsidian'])
    expect(spoke?.tiles.every((tile) => tile.discovered)).toBe(true)
  })

  test('a product of the focused element is not offered as a tile back to itself', () => {
    // acid + water leaves water: the words still say so, but the only tile
    // would lead back to the centre.
    const [spoke] = ringFor('water', viewOf('react:acid+water')).spokes
    expect(spoke?.outcome).toBe('water')
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
    // The raise seen from its products points in; seen from the sprout, out.
    expect(ringFor('tip', viewOf('raise:sprout')).spokes[0]?.direction).toBe('in')
    expect(ringFor('stalk', viewOf('raise:sprout')).spokes[0]?.direction).toBe('in')
    expect(ringFor('sprout', viewOf('raise:sprout')).spokes[0]?.direction).toBe('out')
    // Germination from the water reagent's side is an outward arrow at moss.
    expect(ringFor('moss', viewOf('germinate:moss')).spokes[0]?.direction).toBe('in')
    expect(ringFor('water', viewOf('germinate:moss')).spokes[0]?.direction).toBe('out')
    expect(ringFor('flower', viewOf('bloom:tip')).spokes[0]?.direction).toBe('in')
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
})
