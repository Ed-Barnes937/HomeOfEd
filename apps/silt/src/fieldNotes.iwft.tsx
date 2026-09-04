import { expect } from '@playwright/experimental-ct-react'

import { entryIndex } from './features/fieldNotes/entries.ts'
import { GRID_HEIGHT } from './sim/index.ts'
import { seedMastery, seedWitnessed } from './testing/fieldNotesSeed.ts'
import { test } from './testing/iwftTest.tsx'

const FLOOR = GRID_HEIGHT - 1

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

  expect(await root.fieldNotesCount()).toBe('0/46')
  await root.verifyFieldNotesChip('untouched')

  await root.openFieldNotes()
  const counters = await root.fieldNotesCounters()
  expect(counters.elements).toContain('10/20')
  expect(counters.interactions).toContain('0/46')
  // No chip until something has been discovered since the panel last closed.
  expect(counters.fresh).toBe('')

  await root.verifyFieldNotesEmpty()
})

test('a seeded chart opens on the counts its witnessed set implies', async ({ mountApp, page }) => {
  await seedWitnessed(page, SEEDED, { reviewed: 0 })
  const { root } = await mountApp()
  await root.verifyIsShown()

  expect(await root.fieldNotesCount()).toBe('2/46')
  await root.verifyFieldNotesChip('in progress')

  await root.openFieldNotes()
  const counters = await root.fieldNotesCounters()
  // Ten pre-known plus steam, obsidian and smoke.
  expect(counters.elements).toContain('13/20')
  expect(counters.interactions).toContain('2/46')
  expect(counters.fresh).toContain('3')

  // The picker counts every entry that involves an element, reagent or product
  // (spec §6): water has ten, one of them witnessed; obsidian's one is done.
  expect(await root.noteRow('water')).toContain('1/10')
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
  // One of water's ten entries has been witnessed; the other nine are notches.
  expect(await root.noteSpokeCount()).toBe(1)
  expect(await root.noteStillToFind()).toBe('9')

  // Tapping the outcome's own tile is the way into its entry (spec §6).
  await root.followProduct('obsidian')
  expect(await root.focusedNote()).toBe('obsidian')
  // Obsidian is made by the one pair, which is witnessed: nothing left to find.
  expect(await root.noteStillToFind()).toBe('0')

  // And the ring's own tile follows too - back the way it came.
  await root.followSpoke('lava')
  expect(await root.focusedNote()).toBe('lava')
})

test('the focused element wears its sim tags under its name (ticket 12)', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, SEEDED)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  // Which words the allowlist picks is `panelModel.test.ts`'s; what this is for
  // is that they reach the screen and follow the focus. "flammable" on wood *is*
  // the hint that fire has business with it.
  await root.selectNote('wood')
  expect(await root.focusedNote()).toBe('wood')
  expect(await root.focusedNoteTags()).toContain('flammable')

  await root.selectNote('water')
  expect(await root.focusedNoteTags()).not.toContain('flammable')
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

/**
 * The key (ticket 11). Thin on purpose: which rows the key holds is derived and
 * pinned in `panelModel.test.ts`, so what this case is for is the toggle - the
 * block is collapsed until asked for, and it is the chart's footer that asks.
 */
test('the footer opens a key for the line kinds the chart draws', async ({ mountApp, page }) => {
  await seedWitnessed(page, SEEDED)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  await root.verifyFieldNotesKey(false)

  await root.toggleFieldNotesKey()
  await root.verifyFieldNotesKey(true)
  await root.verifyFieldNotesKeyRow('decay')
  // The labels wear the chrome's uppercase, as every Silkscreen label does.
  expect((await root.fieldNotesKeyText()).toLowerCase()).toContain('decay')

  // It remembers nothing: closed again here, and gone entirely on the next open.
  await root.toggleFieldNotesKey()
  await root.verifyFieldNotesKey(false)
  await root.closeFieldNotes()
  await root.openFieldNotes()
  await root.verifyFieldNotesKey(false)
})

test('a mastered element wears its star, and mud states what it costs to unlock', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, ['react:dirt+water'])
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  expect(await root.noteRow('mud')).toContain('1/6 to unlock')
  await root.verifyNoteMastered('mud', false)

  await root.closeFieldNotes()
  await seedMastery(page, 'mud')
  await page.reload()
  const { root: mastered } = await mountApp()
  await mastered.openFieldNotes()

  expect(await mastered.noteRow('mud')).toContain('6/6')
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

  expect((await root.fieldNotesCounters()).interactions).toContain('0/46')
  await root.verifyFieldNotesEmpty()
  await root.closeFieldNotes()
  expect(await root.fieldNotesCount()).toBe('0/46')

  // It really is gone, not just gone from this render.
  await page.reload()
  const { root: reloaded } = await mountApp()
  expect(await reloaded.fieldNotesCount()).toBe('0/46')
})

/**
 * The loop as a player lives it (ticket 06): the sim witnesses something, the
 * card rises over the world, the header ticks, and the entry is already in the
 * panel when they go looking. The sim's seed is fixed, so a stepped world does
 * exactly this every run.
 */
test('a first witness raises a card, ticks the chip and lights the panel', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  expect(await root.fieldNotesCount()).toBe('0/46')
  await root.verifyNoMomentCard()

  // A pool of water dropped straight onto lava: obsidian and steam, both new.
  await root.selectBrush(2)
  await root.selectElement('lava')
  await root.paintCell(150, 120)
  await root.selectElement('water')
  await root.paintCell(150, 115)
  await root.step()

  await root.verifyMomentCard('new entry')
  const card = await root.momentText()
  expect(card).toContain('obsidian')
  expect(card).toContain('steam')

  await expect.poll(() => root.fieldNotesCount()).toBe('1/46')

  // The panel is derived from the same store, so there is nothing to refresh.
  await root.openFieldNotes()
  expect(await root.noteRow('obsidian')).toContain('1/1')
  await root.selectNote('water')
  expect(await root.noteSpokeCount()).toBe(1)
})

/**
 * The panel is a window on the store, not a snapshot of it: the world goes on
 * behind it, and a first witnessed while it is open lands in the ring the
 * player is already looking at. No special path - React re-renders off the same
 * store the chip reads.
 */
test('a first witnessed while the panel is open lands in the ring in place', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Set up but not yet run: painting is never a discovery, so the chart is
  // still empty with the two of them touching.
  await root.selectBrush(2)
  await root.selectElement('lava')
  await root.paintCell(150, 120)
  await root.selectElement('water')
  await root.paintCell(150, 115)

  // Nothing witnessed yet, so the panel opens on its empty state.
  await root.openFieldNotes()
  await root.verifyFieldNotesEmpty()

  // One tick, from the step hotkey - the panel is an overlay, not a modal on
  // the world.
  await root.pressKey('.')

  await expect.poll(() => root.fieldNotesCount()).toBe('1/46')
  await root.selectNote('water')
  expect(await root.focusedNote()).toBe('water')
  expect(await root.noteSpokeCount()).toBe(1)
  expect(await root.noteStillToFind()).toBe('9')
})

test("the fifth of mud's entries unlocks it, rail and all, without a reload", async ({
  mountApp,
  page,
}) => {
  // The raw edges, because that is what a witness set holds: an entry is
  // mastered only once every edge behind it has fired (ticket 08).
  const mudEdges = entryIndex().witnessKeysFor('mud')
  await seedWitnessed(
    page,
    mudEdges.filter((key) => key !== 'react:dirt+water'),
  )
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyNoEarnedControl()

  // dirt + water is the one left. Mud itself was discovered long ago (ash +
  // water makes it too), so this witnesses the entry, not the element.
  await root.selectBrush(2)
  await root.selectElement('dirt')
  await root.paintCell(150, 120)
  await root.selectElement('water')
  await root.paintCell(150, 115)
  await root.step()

  // The unlock card queues behind the entry's own card - one at a time.
  await root.verifyMomentCard('mud joins your rail')
  await root.openEarned()
  expect(await root.earnedElementNames()).toEqual(['mud'])
})

test('the last entry of all raises the completion line, once ever', async ({ mountApp, page }) => {
  await seedWitnessed(
    page,
    entryIndex().witnessKeys.filter((key) => key !== 'react:dirt+water'),
  )
  const { root } = await mountApp()
  await root.verifyIsShown()
  expect(await root.fieldNotesCount()).toBe('45/46')
  await root.verifyNoChartCompleteLine()

  await root.selectBrush(2)
  await root.selectElement('dirt')
  await root.paintCell(150, 120)
  await root.selectElement('water')
  await root.paintCell(150, 115)
  await root.step()

  await root.verifyChartCompleteLine()
  await expect.poll(() => root.fieldNotesCount()).toBe('46/46')
  await root.verifyFieldNotesChip('complete')

  // Once, at the transition - a finished chart is not greeted on every load.
  await page.reload()
  const { root: reloaded } = await mountApp()
  await reloaded.verifyIsShown()
  await reloaded.verifyNoChartCompleteLine()
})

// The chart's only reward for finishing is that it is finished (decision 4):
// the chip inverts, and nothing else is left behind.
test('the header chip inverts for good once every interaction is witnessed', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, entryIndex().witnessKeys)
  const { root } = await mountApp()
  await root.verifyIsShown()

  expect(await root.fieldNotesCount()).toBe('46/46')
  await root.verifyFieldNotesChip('complete')

  // Everything mastered means everything earned, so the rail stops promising
  // more (spec §7 - it may say that there is more, never what).
  await root.openEarned()
  await root.verifyMoreToEarn(false)
})

/**
 * The hook edges, as a player lives them (ticket 07): a bed built from the rail
 * alone - dirt wetted to mud, seeds dropped in - buries and germinates on the
 * sim's own slow draws, and the plant that comes up is a discovery like any
 * other: its "?" tile reveals and the element count moves. Thin on purpose; the
 * key-by-key behaviour is pinned in `witness.test.ts` and `entries.test.ts`.
 */
test('a plant grown live from the bed reveals its tile and moves the element count', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Built paused, so the world is identical every run: a wide dirt mound, two
  // thin pinches of seed above it, water above those. On play the water wets
  // the bed to mud, the seeds bury into it, and the open sky germinates the
  // bank. Seeds are the narrow brush on purpose - a pile of them roofs its own
  // bed and the bank sleeps under it (measured: a wide dab pushed germination
  // past 1500 ticks; this shape lands within a few hundred).
  await root.selectBrush(3)
  await root.selectElement('dirt')
  await root.paintCell(146, FLOOR)
  await root.paintCell(150, FLOOR)
  await root.paintCell(154, FLOOR)
  await root.selectBrush(1)
  await root.selectElement('seed')
  await root.paintCell(147, FLOOR - 8)
  await root.paintCell(153, FLOOR - 8)
  await root.selectBrush(2)
  await root.selectElement('water')
  await root.paintCell(146, FLOOR - 14)
  await root.paintCell(154, FLOOR - 14)

  await root.openFieldNotes()
  const before = await root.fieldNotesCounters()
  expect(before.elements).toContain('10/20')
  // The plant is one row since ticket 08: what comes up out of the bed is a
  // flower, not a sprout that is also a tip that is also a stalk.
  await root.verifyNoteRowIsInert('flower')
  await root.verifyNoteRowIsInert('moss')

  // The panel is an overlay, not a modal on the world: the sim runs behind it
  // and firsts land in the open picker - so play via the hotkey, since the
  // pill is under the scrim. Germination is a slow draw by design (~one in
  // five hundred ticks per bank), so the poll is generous.
  await root.pressKey(' ')
  await expect
    .poll(
      async () => {
        const flower = await root.noteRow('flower')
        const moss = await root.noteRow('moss')
        return flower.includes('flower') || moss.includes('moss')
      },
      { timeout: 40_000 },
    )
    .toBe(true)

  // Mud came up on the way, so the count has moved past the pre-knowns - the
  // exact tally depends on how far the plant got before this read. Burial is no
  // longer an element of its own (ticket 08): it is what the seed is doing.
  const after = await root.fieldNotesCounters()
  const discovered = Number(/(\d+)\/20/.exec(after.elements)?.[1])
  expect(discovered).toBeGreaterThanOrEqual(12)
})

/**
 * The charted grouping through the whole stack (ticket 08): the sim reports raw
 * keys naming species the chart does not - a bloomed tip, a burnt stalk - and
 * what the player sees move is the flower's own row. Seeded rather than grown,
 * because landing lava on a live stalk means waiting out a germination first;
 * what the sim reports is pinned in `witness.test.ts` and the fold in
 * `entries.test.ts`.
 */
test("a raw edge of one of the plant's parts lands on the flower's row", async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, ['bloom:tip', 'react:lava+stalk'])
  const { root } = await mountApp()
  await root.verifyIsShown()
  expect(await root.fieldNotesCount()).toBe('2/46')

  await root.openFieldNotes()
  // Two of the flower's nine, and no row for the stalk that actually burned.
  expect(await root.noteRow('flower')).toContain('2/9')
  expect(await root.fieldNotesText()).not.toContain('stalk')

  await root.selectNote('flower')
  expect(await root.focusedNote()).toBe('flower')
  expect(await root.noteSpokeCount()).toBe(2)
  expect(await root.noteStillToFind()).toBe('7')
})
