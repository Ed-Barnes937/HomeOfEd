import { beforeEach, describe, expect, test } from 'vitest'

import { entryIndex } from './entries.ts'
import { FieldNotesStore, createMemoryStorage, type FieldNotesStorage } from './fieldNotesStore.ts'
import { fieldNotesView } from './fieldNotesView.ts'

const notes = entryIndex()

/** Spec §1: the five edges that master mud, and so unlock the rail slot. */
const MUD_KEYS = [
  'react:dirt+water',
  'react:ash+water',
  'react:fire+mud',
  'react:lava+mud',
  'react:mud+seed',
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

    // lava + water is one of water's nine entries, and obsidian's only one.
    expect(view.counts.get('water')).toEqual({ seen: 1, total: notes.entriesFor('water').length })
    expect(view.counts.get('obsidian')).toEqual({ seen: 1, total: 1 })
    expect(view.counts.get('sand')).toEqual({ seen: 0, total: notes.entriesFor('sand').length })
    expect(view.totals.interactions).toEqual({ seen: 1, total: notes.keys.length })
    // Products of a witnessed entry are discovered; nothing else moves.
    expect(view.discovered.has('obsidian')).toBe(true)
    expect(view.discovered.has('ash')).toBe(false)
  })

  test("mud's five keys unlock mud, and survive the reload that proves nothing derived is stored", () => {
    for (const key of MUD_KEYS) store.witness([key])

    const view = reloaded()

    expect(view.mastered.has('mud')).toBe(true)
    expect(view.unlocked).toEqual(['mud'])
    expect(view.counts.get('mud')).toEqual({ seen: 5, total: 5 })
  })

  test('the rail is told there is more to earn only while there is (spec §7)', () => {
    expect(fieldNotesView(store.progress, notes).moreToEarn).toBe(true)

    // Four of mud's five: something is still to be earned, and the teaser must
    // still say nothing about what.
    for (const key of MUD_KEYS.slice(0, 4)) store.witness([key])
    expect(reloaded().moreToEarn).toBe(true)

    // Mud is the roster's only unlockable, so mastering it empties the promise.
    store.witness([MUD_KEYS[4]!])
    expect(reloaded().moreToEarn).toBe(false)
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
