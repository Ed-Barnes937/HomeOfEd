import { beforeEach, describe, expect, test } from 'vitest'

import { entryIndex } from './entries.ts'
import {
  FieldNotesStore,
  PROGRESS_KEY,
  PROGRESS_VERSION,
  createMemoryStorage,
  type FieldNotesStorage,
} from './fieldNotesStore.ts'
import { fieldNotesView } from './fieldNotesView.ts'

const notes = entryIndex()

/** The six edges that master mud, and so unlock the rail slot (spec §1's five plus mud + petal, life epic). */
const MUD_KEYS = [
  'react:dirt+water',
  'react:ash+water',
  'react:fire+mud',
  'react:lava+mud',
  'react:mud+seed',
  'react:mud+petal',
]

let storage: FieldNotesStorage
let store: FieldNotesStore

beforeEach(() => {
  storage = createMemoryStorage()
  store = new FieldNotesStore(storage)
})

/** What the panel would see after a page reload: fresh store, same bytes. */
function reloaded() {
  return fieldNotesView(new FieldNotesStore(storage).progress, notes)
}

describe('fieldNotesView()', () => {
  test('a fresh install knows the rail and nothing else', () => {
    const view = fieldNotesView(store.progress, notes)

    expect([...view.witnessed]).toEqual([])
    expect([...view.discovered].sort()).toEqual([...notes.preKnown].sort())
    expect([...view.mastered]).toEqual([])
    expect(view.unlocked).toEqual([])
    expect(view.totals).toEqual({
      elements: { seen: notes.preKnown.length, total: notes.elements.length },
      interactions: { seen: 0, total: notes.keys.length },
    })
  })

  test('counts every element against the entries that involve it', () => {
    store.witness(['react:lava+water'])
    const view = reloaded()

    // lava + water is one of water's ten entries, and obsidian's only one.
    expect(view.counts.get('water')).toEqual({ seen: 1, total: notes.entriesFor('water').length })
    expect(view.counts.get('obsidian')).toEqual({ seen: 1, total: 1 })
    expect(view.counts.get('sand')).toEqual({ seen: 0, total: notes.entriesFor('sand').length })
    expect(view.totals.interactions).toEqual({ seen: 1, total: notes.keys.length })
    // Products of a witnessed entry are discovered; nothing else moves.
    expect(view.discovered.has('obsidian')).toBe(true)
    expect(view.discovered.has('ash')).toBe(false)
  })

  test("mud's six keys unlock mud, and survive the reload that proves nothing derived is stored", () => {
    for (const key of MUD_KEYS) store.witness([key])

    const view = reloaded()

    expect(view.mastered.has('mud')).toBe(true)
    expect(view.unlocked).toEqual(['mud'])
    expect(view.counts.get('mud')).toEqual({ seen: 6, total: 6 })
  })

  test('the rail is told there is more to earn only while there is (spec §7)', () => {
    expect(fieldNotesView(store.progress, notes).moreToEarn).toBe(true)

    // Five of mud's six: something is still to be earned, and the teaser must
    // still say nothing about what.
    for (const key of MUD_KEYS.slice(0, 5)) store.witness([key])
    expect(reloaded().moreToEarn).toBe(true)

    // Mud is no longer the only unlockable (ticket 14), so mastering it leaves
    // the promise standing; only the whole roster empties it.
    store.witness([MUD_KEYS[5]!])
    expect(reloaded().moreToEarn).toBe(true)

    store.witness([...notes.witnessKeys])
    expect(reloaded().moreToEarn).toBe(false)
  })

  test("the unlock denominator is the whole discoverable roster (ticket 14)", () => {
    // What the view promises against: `moreToEarn` is measured over every
    // charted non-base element, so witnessing the lot must empty it exactly.
    // The roster itself is pinned as a literal in `entries.test.ts`.
    expect(notes.unlockable).toHaveLength(notes.elements.length - notes.preKnown.length)

    store.witness([...notes.witnessKeys])
    const view = reloaded()

    expect(view.unlocked).toEqual([...notes.unlockable])
    expect(view.moreToEarn).toBe(false)
    for (const name of notes.preKnown) expect(view.unlocked).not.toContain(name)
  })

  test('an edge key this roster cannot resolve counts for nothing', () => {
    store.witness([...MUD_KEYS, 'react:unobtanium+water'])

    const view = reloaded()

    expect(view.unlocked).toEqual(['mud'])
    expect(view.totals.interactions.seen).toBe(MUD_KEYS.length)
  })

  test('NEW is what has been discovered since the panel last showed it', () => {
    store.witness(['react:lava+water'])
    expect([...reloaded().newElements].sort()).toEqual(['obsidian', 'steam'])

    // The panel has now shown them, so they stop being new - and stay that way
    // across the reload, since the watermark is stored and the names are not.
    store.markReviewed()
    expect([...reloaded().newElements]).toEqual([])

    // An entry with no new product leaves nothing new to say.
    store.witness(['react:acid+dirt'])
    expect([...reloaded().newElements]).toEqual([])

    store.witness(['react:acid+wood'])
    expect([...reloaded().newElements]).toEqual(['sulphur'])
  })

  /**
   * The migration that is not one (ticket 08). Charting the plant's parts as
   * flower changed the view, not the store: these are the keys a player's blob
   * held before the change, written by hand exactly as the sim reported them,
   * and every one of them still lands on the entry it always did.
   */
  test('a blob written before the grouping derives the same progress after it', () => {
    const written = [
      'react:lava+water',
      'react:mud+petal',
      'react:lava+stalk',
      'react:acid+buried',
      'bloom:tip',
      'raise:sprout',
    ]
    storage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: PROGRESS_VERSION, edges: written, reviewed: written.length }),
    )

    const view = reloaded()

    // Nothing is lost on the way in: the raw keys are still what is stored.
    expect([...view.witnessed].sort()).toEqual([...written].sort())
    // Six raw edges, six entries - none of these six shares a charted key.
    expect(view.totals.interactions.seen).toBe(6)
    // And what they discovered is what they always discovered, under the name
    // the chart now gives it: a bloomed tip is a flower.
    expect(view.discovered.has('flower')).toBe(true)
    expect(view.discovered.has('steam')).toBe(true)
    expect(view.counts.get('flower')).toEqual({ seen: 4, total: 9 })
    // Mud's petal edge still counts for mud, charted as `react:flower+mud`.
    expect(view.counts.get('mud')?.seen).toBe(1)
  })

  test('reset takes the derived sets back to a fresh install', () => {
    for (const key of MUD_KEYS) store.witness([key])
    store.markReviewed()

    store.reset()

    const view = reloaded()
    expect([...view.witnessed]).toEqual([])
    expect([...view.discovered].sort()).toEqual([...notes.preKnown].sort())
    expect([...view.mastered]).toEqual([])
    expect(view.unlocked).toEqual([])
    expect([...view.newElements]).toEqual([])
    expect(view.totals.interactions.seen).toBe(0)
  })
})
