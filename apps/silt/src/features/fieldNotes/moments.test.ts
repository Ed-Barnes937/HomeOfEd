import { describe, expect, test } from 'vitest'

import { entryIndex } from './entries.ts'
import { fieldNotesView } from './fieldNotesView.ts'
import {
  advanceCompletion,
  completionAtBoot,
  dismissCompletion,
  MOMENT_QUEUE_LIMIT,
  momentsFor,
  queueMoments,
  type Moment,
} from './moments.ts'
import { HIDDEN_NAME } from './panelModel.ts'

const notes = entryIndex()

/** A player who has witnessed exactly `edges`, with nothing left unreviewed. */
function viewOf(...edges: string[]) {
  return fieldNotesView({ edges, reviewed: edges.length })
}

/** The cards raised by going from one witnessed set to another. */
function movingTo(before: readonly string[], after: readonly string[]): readonly Moment[] {
  return momentsFor(viewOf(...before), viewOf(...after))
}

/** Everything a card puts on screen: its words and the names under its tiles. */
function wordsOf(moment: Moment): string {
  return [moment.lead, moment.title, ...moment.tiles.map((tile) => tile.label)].join(' ')
}

describe('discovery cards', () => {
  test('a first witness that revealed elements names them, and wears their tiles', () => {
    const [card, ...rest] = movingTo([], ['react:lava+water'])
    expect(rest).toEqual([])
    expect(card?.kind).toBe('discovery')
    expect(card?.lead).toBe('new entry')
    expect(card?.title).toBe('steam · obsidian')
    expect(card?.tiles.map((tile) => tile.name)).toEqual(['steam', 'obsidian'])
    // The tile arrives wearing the green edge the panel will show it with.
    expect(card?.fresh).toBe(true)
  })

  test('a first witness that revealed nothing names the interaction instead', () => {
    // Acid and dirt consume each other: a new entry, but no new element.
    const [card] = movingTo([], ['react:acid+dirt'])
    expect(card?.kind).toBe('discovery')
    expect(card?.lead).toBe('new entry')
    expect(card?.title).toBe('acid + dirt')
    expect(card?.tiles.map((tile) => tile.name)).toEqual(['acid', 'dirt'])
    expect(card?.fresh).toBe(false)
  })

  test('one card per entry, in the order the sim witnessed them', () => {
    const cards = movingTo([], ['decay:fire', 'react:acid+wood'])
    expect(cards.map((card) => card.title)).toEqual(['smoke', 'sulphur'])
  })

  test('progress that moved without a new entry raises nothing', () => {
    // Closing the panel (`markReviewed`) and forgetting discoveries both change
    // the view without witnessing anything.
    expect(movingTo(['decay:fire'], ['decay:fire'])).toEqual([])
    expect(movingTo(['decay:fire'], [])).toEqual([])
  })

  test('a second raw edge of an entry already witnessed is not news (ticket 08)', () => {
    // Burning a sprout and burning a stalk are one charted entry: the first
    // raises the card, and the rest of the plant raises nothing.
    const [first, ...rest] = movingTo([], ['react:fire+sprout'])
    expect(first?.title).toBe('steam')
    expect(rest).toEqual([])
    expect(movingTo(['react:fire+sprout'], ['react:fire+sprout', 'react:fire+stalk'])).toEqual([])
    // Nor do two of them arriving in the same batch raise two cards.
    expect(movingTo([], ['react:fire+sprout', 'react:fire+stalk'])).toHaveLength(1)
  })
})

describe('the mastery unlock card', () => {
  const mudEdges = notes.witnessKeysFor('mud')

  test('mastering an unlockable follows its discovery card', () => {
    const before = mudEdges.slice(0, -1)
    const cards = movingTo(before, mudEdges)

    // The unlock comes last, so a collapsing burst keeps it (`queueMoments`).
    const unlock = cards.at(-1)
    expect(unlock?.kind).toBe('unlock')
    expect(unlock?.lead).toBe(`mud · ${mudEdges.length} of ${mudEdges.length}`)
    expect(unlock?.title).toBe('mud joins your rail')
    expect(unlock?.tiles.map((tile) => tile.name)).toEqual(['mud'])
  })

  test('mastering something that is not unlockable is not a card', () => {
    // Obsidian's one entry masters it, but nothing joins the rail for it.
    const cards = movingTo([], notes.witnessKeysFor('obsidian'))
    expect(cards.every((card) => card.kind === 'discovery')).toBe(true)
  })
})

/**
 * The spoiler rule reaches the cards too (spec §7): a card may name what the
 * entry just discovered - it is discovered the instant the card exists - and
 * nothing else. Witnessing an edge discovers every product of that edge, so the
 * dangerous case is the *reagents* of an entry that revealed nothing: a scene
 * saved before the rail trim restores painted mud, and dropping lava on it
 * witnesses `lava + mud` while mud has never been discovered.
 */
describe('the spoiler rule', () => {
  test('no card ever names an element the player has not discovered', () => {
    // Every raw edge the sim can report, since that is what a witness holds -
    // and since ticket 08 a charted entry can name products no single one of
    // them leaves.
    for (const key of notes.witnessKeys) {
      const after = viewOf(key)
      const shown = momentsFor(viewOf(), after).map(wordsOf).join(' ')
      for (const name of notes.elements) {
        if (after.discovered.has(name)) continue
        expect(shown, `${key} named the hidden ${name}`).not.toContain(name)
      }
    }
  })

  test('an undiscovered reagent is masked, tile and words alike', () => {
    const [card] = movingTo([], ['react:lava+mud'])
    expect(card?.title).toBe(`lava + ${HIDDEN_NAME}`)
    expect(card?.tiles.map((tile) => tile.discovered)).toEqual([true, false])
  })
})

describe('the queue', () => {
  const cardsNamed = (...titles: string[]): readonly Moment[] =>
    titles.map((title) => ({
      id: title,
      kind: 'discovery',
      tiles: [],
      lead: 'new entry',
      title,
      fresh: false,
    }))

  test('a quiet trickle simply queues', () => {
    const queue = queueMoments(cardsNamed('a'), cardsNamed('b'))
    expect(queue.map((card) => card.title)).toEqual(['a', 'b'])
  })

  test('a burst collapses to the card on screen and the newest few', () => {
    const queue = queueMoments(cardsNamed('showing'), cardsNamed('b', 'c', 'd', 'e', 'f'))
    expect(queue).toHaveLength(MOMENT_QUEUE_LIMIT)
    // The head is mid-animation, so it is never the one dropped; the backlog
    // keeps the newest, because quiet beats complete.
    expect(queue.map((card) => card.title)).toEqual(['showing', 'e', 'f'])
  })
})

describe('the 100% moment', () => {
  /** Plays a sequence of "is the chart complete?" and counts the showings. */
  function showings(boot: boolean, ...steps: boolean[]): number {
    let state = completionAtBoot(boot)
    let shown = 0
    for (const complete of steps) {
      state = advanceCompletion(state, complete)
      if (state.showing) {
        shown++
        state = dismissCompletion(state)
      }
    }
    return shown
  }

  test('fires exactly once, on the transition into a complete chart', () => {
    expect(showings(false, false, false, true, true, true)).toBe(1)
  })

  test('a chart that was already complete on arrival never fires', () => {
    expect(showings(true, true, true)).toBe(0)
  })

  test('forgetting and re-finishing does not fire it again', () => {
    expect(showings(false, true, false, true)).toBe(1)
  })
})
