import { expect } from '@playwright/experimental-ct-react'

import { entryIndex } from './features/fieldNotes/entries.ts'
import { seedMastery, seedWitnessed } from './testing/fieldNotesSeed.ts'
import { test } from './testing/iwftTest.tsx'

/**
 * The Field notes panel end to end (discovery-tree spec §6, §7). The picker
 * ordering, the spoke model and the masking are covered as pure functions in
 * `panelModel.test.ts`; what these cases are for is the state reaching the
 * screen - the seeded store, the counters it implies, and what a tap does.
 */

// water + lava (steam, obsidian) and fire's decay (smoke): three discoveries
// across two interactions, which is enough for every counter to be a different
// number.
const SEEDED = ['react:lava+water', 'decay:fire']

test('a fresh chart is untouched, and says so without naming anything', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  expect(await root.fieldNotesCount()).toBe('0/37')
  await root.verifyFieldNotesChip('untouched')

  await root.openFieldNotes()
  const counters = await root.fieldNotesCounters()
  expect(counters.elements).toContain('10/19')
  expect(counters.interactions).toContain('0/37')
  // No chip until something has been discovered since the panel last closed.
  expect(counters.fresh).toBe('')

  await root.verifyFieldNotesEmpty()
})

test('a seeded chart opens on the counts its witnessed set implies', async ({ mountApp, page }) => {
  await seedWitnessed(page, SEEDED, { reviewed: 0 })
  const { root } = await mountApp()
  await root.verifyIsShown()

  expect(await root.fieldNotesCount()).toBe('2/37')
  await root.verifyFieldNotesChip('in progress')

  await root.openFieldNotes()
  const counters = await root.fieldNotesCounters()
  // Ten pre-known plus steam, obsidian and smoke.
  expect(counters.elements).toContain('13/19')
  expect(counters.interactions).toContain('2/37')
  expect(counters.fresh).toContain('3')

  // The picker counts every entry that involves an element, reagent or product
  // (spec §6): water has nine, one of them witnessed; obsidian's one is done.
  expect(await root.noteRow('water')).toContain('1/9')
  expect(await root.noteRow('obsidian')).toContain('1/1')

  // Closing the panel is what marks it all reviewed, so the chip is gone next time.
  await root.closeFieldNotes()
  await root.openFieldNotes()
  expect((await root.fieldNotesCounters()).fresh).toBe('')
})

test('an undiscovered element keeps its slot as a "?" and cannot be picked (spec §7)', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, SEEDED)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  await root.verifyNoteRowIsInert('vine')
  expect(await root.noteRow('vine')).not.toContain('vine')

  // The ring is still holding whatever was focused - a dead slot changes nothing.
  await root.selectNote('water')
  expect(await root.focusedNote()).toBe('water')
})

test('the ring draws only witnessed entries, and a product tile follows itself', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, SEEDED)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  await root.selectNote('water')
  expect(await root.focusedNote()).toBe('water')
  // One of water's nine entries has been witnessed; the other eight are notches.
  expect(await root.noteSpokeCount()).toBe(1)
  expect(await root.noteStillToFind()).toBe('8')

  // Tapping the outcome's own tile is the way into its entry (spec §6).
  await root.followProduct('obsidian')
  expect(await root.focusedNote()).toBe('obsidian')
  // Obsidian is made by the one pair, which is witnessed: nothing left to find.
  expect(await root.noteStillToFind()).toBe('0')

  // And the ring's own tile follows too - back the way it came.
  await root.followSpoke('lava')
  expect(await root.focusedNote()).toBe('lava')
})

/**
 * The invariant, from the design notes: nothing in the panel may name a hidden
 * element. It is not hypothetical - a scene saved before the rail trim restores
 * painted mud, and dropping lava on it witnesses `lava + mud` while mud itself
 * has never been discovered.
 */
test('nothing in the panel names an element the player has not discovered', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, ['react:lava+mud'])
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  await root.selectNote('stone')
  expect(await root.focusedNote()).toBe('stone')

  const shown = (await root.fieldNotesText()).toLowerCase()
  expect(shown).toContain('stone')
  for (const hidden of ['mud', 'vine', 'moss', 'ash', 'ember', 'sulphur', 'obsidian']) {
    expect(shown).not.toContain(hidden)
  }
})

test('a mastered element wears its star, and mud states what it costs to unlock', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, ['react:dirt+water'])
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  expect(await root.noteRow('mud')).toContain('1/5 to unlock')
  await root.verifyNoteMastered('mud', false)

  await root.closeFieldNotes()
  await seedMastery(page, 'mud')
  await page.reload()
  const { root: mastered } = await mountApp()
  await mastered.openFieldNotes()

  expect(await mastered.noteRow('mud')).toContain('5/5')
  expect(await mastered.noteRow('mud')).not.toContain('to unlock')
  await mastered.verifyNoteMastered('mud', true)
})

test('"forget discoveries" needs a second click, and empties the chart when it gets one', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, SEEDED)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  await root.forgetDiscoveries()

  expect((await root.fieldNotesCounters()).interactions).toContain('0/37')
  await root.verifyFieldNotesEmpty()
  await root.closeFieldNotes()
  expect(await root.fieldNotesCount()).toBe('0/37')

  // It really is gone, not just gone from this render.
  await page.reload()
  const { root: reloaded } = await mountApp()
  expect(await reloaded.fieldNotesCount()).toBe('0/37')
})

// The chart's only reward for finishing is that it is finished (decision 4):
// the chip inverts, and nothing else is left behind.
test('the header chip inverts for good once every interaction is witnessed', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, entryIndex().keys)
  const { root } = await mountApp()
  await root.verifyIsShown()

  expect(await root.fieldNotesCount()).toBe('37/37')
  await root.verifyFieldNotesChip('complete')

  // Everything mastered means everything earned, so the rail stops promising
  // more (spec §7 - it may say that there is more, never what).
  await root.openEarned()
  await root.verifyMoreToEarn(false)
})
