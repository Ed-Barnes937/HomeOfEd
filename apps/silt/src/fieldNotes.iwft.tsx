import { expect } from '@playwright/experimental-ct-react'

import { entryIndex } from './features/fieldNotes/entries.ts'
import { PROGRESS_KEY } from './features/fieldNotes/fieldNotesStore.ts'
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

  expect(await root.fieldNotesCount()).toBe('0/54')
  await root.verifyFieldNotesChip('untouched')

  await root.openFieldNotes()
  const counters = await root.fieldNotesCounters()
  expect(counters.elements).toContain('10/21')
  expect(counters.interactions).toContain('0/54')
  // No chip until something has been discovered since the panel last closed.
  expect(counters.fresh).toBe('')

  await root.verifyFieldNotesEmpty()
})

test('a seeded chart opens on the counts its witnessed set implies', async ({ mountApp, page }) => {
  await seedWitnessed(page, SEEDED, { reviewed: 0 })
  const { root } = await mountApp()
  await root.verifyIsShown()

  expect(await root.fieldNotesCount()).toBe('2/54')
  await root.verifyFieldNotesChip('in progress')

  await root.openFieldNotes()
  const counters = await root.fieldNotesCounters()
  // Ten pre-known plus steam, obsidian and smoke.
  expect(counters.elements).toContain('13/21')
  expect(counters.interactions).toContain('2/54')
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

test('the ring draws only witnessed entries, and reading one is a tap on it', async ({
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

  // Nothing read yet: the band holds its hint, and it is the same height as it
  // will be with a recipe in it (ticket 25).
  expect(await root.readingLine()).toContain('tap a spoke')
  const empty = await root.readingBandHeight()

  // A tap on the ring reads the spoke into the band. It does *not* navigate -
  // that is the whole point: a mis-tap no longer throws you onto lava's chart.
  await root.readSpoke('lava')
  expect(await root.focusedNote()).toBe('water')
  expect((await root.readingLine()).toLowerCase()).toContain('lava')
  expect((await root.readingLine()).toLowerCase()).toContain('obsidian')
  expect(await root.readingLineTiles()).toEqual(['lava', 'water', 'steam', 'obsidian'])
  expect(await root.readingBandHeight()).toBe(empty)

  // Following an element is the reading line's job now (spec §6).
  await root.followReadingTile('obsidian')
  expect(await root.focusedNote()).toBe('obsidian')
  // Obsidian is made by the one pair, which is witnessed: nothing left to find.
  expect(await root.noteStillToFind()).toBe('0')
  // And the new ring starts unread rather than carrying the last one's line.
  expect(await root.readingLine()).toContain('tap a spoke')

  await root.readSpoke('lava')
  await root.followReadingTile('lava')
  expect(await root.focusedNote()).toBe('lava')
})

/**
 * The desktop's own two ways into the band (ticket 25): the pointer and the tab
 * key. The phone has the tap, which the case above covers - one band, three
 * ways in, so a mouse never has to click to read and a keyboard never has to
 * hover.
 */
test('hovering a spoke reads it into the band, and so does keyboard focus', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, SEEDED)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  await root.selectNote('fire')
  expect(await root.readingLine()).toContain('tap a spoke')

  await root.hoverSpoke('smoke')
  expect((await root.readingLine()).toLowerCase()).toContain('smoke')

  // A different element's ring starts empty again, and the tab key fills it
  // without a pointer anywhere near the ring.
  await root.selectNote('water')
  expect(await root.readingLine()).toContain('tap a spoke')
  await root.focusSpoke('lava')
  expect((await root.readingLine()).toLowerCase()).toContain('steam')
})

test('the focused element wears its sim tags in the bottom band (ticket 12)', async ({
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
  // Chips above the reading line, both under the ring (ticket 25): the chips
  // describe the element, the line describes the spoke.
  await root.verifyBottomBandOrder()
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
  // With the spoke read into the band, since ticket 25 that band is the one
  // place in the panel where an interaction is put into words at all - so this
  // is the assertion that has to hold there above anywhere else.
  // Lava is the tile on the ring; the pair's other half is the one that has
  // never been discovered, and the line is where it would be named.
  await root.readSpoke('lava')
  expect(await root.readingLine()).toContain('- - -')

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

/**
 * Ticket 22: ticket 11's key was live all along and the person who asked for one
 * still could not find it - an 8px chip wedged behind a tail of still-to-find
 * notches, beside a much wider `forget discoveries`, reads as a footnote rather
 * than as a control. It stays with the ring (the line kinds are the only thing
 * it explains) and has to be legible there.
 */
test('the key toggle reads as a control and leads the footer', async ({ mountApp, page }) => {
  await seedWitnessed(page, SEEDED)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()
  await root.selectNote('water')

  // What the player reads, uppercased by the chrome as every label is - the
  // word, and the "?" that says the word is a question you may ask.
  const label = await root.fieldNotesKeyToggleText()
  expect(label).toContain('KEY')
  expect(label).toContain('?')

  await root.verifyFieldNotesKeyToggleLeadsTheFooter()
  await root.verifyFieldNotesKeyToggleIsOnScreen()
  await root.verifyFieldNotesKeyToggleOutsizesForget()

  // And it still opens the thing it names: a stroke row and the arrowhead rule.
  await root.toggleFieldNotesKey()
  await root.verifyFieldNotesKeyRow('decay')
  await root.verifyFieldNotesKeyRow('react')
  await root.verifyFieldNotesKeyRow('arrow')
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
  await root.verifyNoteStar('mud', 'none')

  await root.closeFieldNotes()
  await seedMastery(page, 'mud')
  await page.reload()
  const { root: mastered } = await mountApp()
  await mastered.openFieldNotes()

  expect(await mastered.noteRow('mud')).toContain('6/6')
  expect(await mastered.noteRow('mud')).not.toContain('to unlock')
  await mastered.verifyNoteStar('mud', 'mastered')
})

/**
 * The hollow star (ticket 18). The flower's row counts *charted* entries, so it
 * fills one raw edge before mastery does - and spec §7 forbids naming the edge
 * it is waiting on. The star is what says the wait is real; the last edge is
 * what ends it, and the unlock still rides on that and nothing else.
 */
test('a full count with a raw edge still out reads hollow, and the last edge fills it', async ({
  mountApp,
  page,
}) => {
  const notes = entryIndex()
  // One raw edge behind a grouped flower entry - acid on one of the plant's
  // parts, say - off the live index rather than written down here.
  const grouped = notes
    .entriesFor('flower')
    .map((key) => notes.get(key)!)
    .find((entry) => entry.sources.length > 1)!
  const every = notes.witnessKeysFor('flower')
  const missing = grouped.sources[1]!.key

  await seedWitnessed(
    page,
    every.filter((key) => key !== missing),
  )
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  const entries = notes.entriesFor('flower').length
  expect(await root.noteRow('flower')).toContain(`${entries}/${entries}`)
  await root.verifyNoteStar('flower', 'partial')
  // Both star sites say the same thing: the row, and the focused element's own
  // name on the ring.
  await root.selectNote('flower')
  await root.verifyFocusedNoteStar('partial')
  // The star is hollow because the unlock has not happened: there is no EARNED
  // control on the rail at all yet.
  await root.closeFieldNotes()
  await root.verifyNoEarnedControl()

  await seedWitnessed(page, every)
  await page.reload()
  const { root: filled } = await mountApp()
  await filled.openFieldNotes()

  await filled.verifyNoteStar('flower', 'mastered')
  await filled.selectNote('flower')
  await filled.verifyFocusedNoteStar('mastered')
  await filled.closeFieldNotes()
  await filled.openEarned()
  expect(await filled.earnedElementNames()).toEqual(['flower'])
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

  expect((await root.fieldNotesCounters()).interactions).toContain('0/54')
  await root.verifyFieldNotesEmpty()
  await root.closeFieldNotes()
  expect(await root.fieldNotesCount()).toBe('0/54')

  // It really is gone, not just gone from this render.
  await page.reload()
  const { root: reloaded } = await mountApp()
  expect(await reloaded.fieldNotesCount()).toBe('0/54')
})

/**
 * Forgetting is not a door that locks behind you (ticket 31): the sim reports
 * each first once per session, so before the witness resync existed a
 * forgotten interaction stayed forgotten until the page was reloaded. This is
 * the loop a player lives - witness, forget, do it again - with no reload in it.
 */
test('an interaction forgotten mid-session is earned again by doing it again', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectBrush(2)
  await root.selectElement('lava')
  await root.paintCell(150, 120)
  await root.selectElement('water')
  await root.paintCell(150, 115)
  await root.step()
  await expect.poll(() => root.fieldNotesCount()).toBe('1/54')

  await root.openFieldNotes()
  await root.forgetDiscoveries()
  await root.closeFieldNotes()
  expect(await root.fieldNotesCount()).toBe('0/54')

  // The same pour, somewhere else on the same running page: the chart earns it
  // back rather than swallowing it.
  await root.selectElement('lava')
  await root.paintCell(80, 120)
  await root.selectElement('water')
  await root.paintCell(80, 115)
  await root.step()

  await expect.poll(() => root.fieldNotesCount()).toBe('1/54')
})

/**
 * The same seam from the other side (ticket 32). A scene load replaces the
 * working progression with the scene's snapshot, wholesale (ADR 0055), so a
 * scene whose snapshot is emptier than the chart drops entries the session has
 * already reported - the second way the progression shrinks under a sim that
 * reports each first once (ticket 30). The load has to carry the same resync
 * "forget discoveries" does, or the dropped entry stays unearnable until a
 * reload.
 */
test('an entry a scene load drops is earned again by doing it again', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Saved before anything was witnessed, so its snapshot is empty - which is
  // also exactly how a scene saved before snapshots existed loads (ADR 0055).
  await root.openScenes()
  await root.saveScene()
  await root.verifySceneRow('scene 1')
  await root.closeScenes()

  await root.selectBrush(2)
  await root.selectElement('lava')
  await root.paintCell(150, 120)
  await root.selectElement('water')
  await root.paintCell(150, 115)
  await root.step()
  await expect.poll(() => root.fieldNotesCount()).toBe('1/54')

  // Loading the emptier scene takes the entry back out of the chart.
  await root.openScenes()
  await root.loadScene('scene 1')
  await expect.poll(() => root.fieldNotesCount()).toBe('0/54')

  // The same pour on the world that arrived with it: earned back, no reload.
  await root.selectElement('lava')
  await root.paintCell(80, 120)
  await root.selectElement('water')
  await root.paintCell(80, 115)
  await root.step()

  await expect.poll(() => root.fieldNotesCount()).toBe('1/54')
})

/**
 * The recents sidebar (ticket 29): the most recently witnessed discoveries,
 * newest first, as many rows as the dialog's height fits and not one more. The
 * derivation (order, dedupe, unknown keys, the element a row draws) is pinned
 * in `panelModel.test.ts`; this is the loop through the UI - witness, open the
 * panel, see it listed first - plus the height rule against a real layout.
 */
test('a fresh witness leads the recents sidebar, and the rows track the height', async ({
  mountApp,
  page,
}) => {
  // Everything but one entry seeded, so the sidebar is height-limited rather
  // than count-limited and the resize below has rows to give up.
  await seedWitnessed(
    page,
    entryIndex().witnessKeys.filter((key) => key !== 'react:dirt+water'),
  )
  const { root } = await mountApp()
  await root.verifyIsShown()

  // dirt + water is the one entry left: witnessed now, it must arrive on top.
  await root.selectBrush(2)
  await root.selectElement('dirt')
  await root.paintCell(150, 120)
  await root.selectElement('water')
  await root.paintCell(150, 115)
  await root.step()
  await expect.poll(() => root.fieldNotesCount()).toBe('54/54')

  await root.openFieldNotes()
  const rows = await root.recentRows()
  // The row wears what the entry left behind: dirt + water leaves mud.
  expect(rows[0]).toBe('mud')
  // Nowhere near all 54 fit, and every row that renders sits whole in the
  // column - no scrollbar, no clipped sliver.
  expect(rows.length).toBeGreaterThan(3)
  expect(rows.length).toBeLessThan(54)
  await root.verifyRecentRowsFitTheSidebar()

  // A shorter dialog renders fewer rows: floor(height / row), re-derived on
  // resize.
  await page.setViewportSize({ width: 1280, height: 520 })
  await expect.poll(async () => (await root.recentRows()).length).toBeLessThan(rows.length)
  expect(await root.recentRows()).toContain('mud')
  await root.verifyRecentRowsFitTheSidebar()
})

/**
 * Progression belongs to the scene (ticket 28): a save snapshots the working
 * field notes into the envelope, and a load replaces them - edges and the
 * NEW-chip watermark alike. The strict semantics (a pre-change scene clears, A
 * then B shows B's, forget-then-save persists the cleared state) are pinned at
 * the store/format layer; this is the loop through the UI on a fresh profile.
 */
test('a saved scene restores its field notes on a fresh profile', async ({ mountApp, page }) => {
  // Reviewed 1 - a watermark neither empty nor full, so only a genuinely
  // restored one can produce the NEW count asserted below: a snapshot that
  // dropped it would read 3, one clamped to the end would read 0.
  await seedWitnessed(page, SEEDED, { reviewed: 1 })
  const first = await mountApp()
  await first.root.verifyIsShown()
  await first.root.openScenes()
  await first.root.saveScene()
  await first.root.verifySceneRow('scene 1')

  // A fresh profile: the scene survives, the working progression does not.
  await page.evaluate((key) => window.localStorage.removeItem(key), PROGRESS_KEY)
  await page.reload()
  const { root } = await mountApp()
  await root.verifyIsShown()
  expect(await root.fieldNotesCount()).toBe('0/54')

  await root.openScenes()
  await root.loadScene('scene 1')
  await expect.poll(() => root.fieldNotesCount()).toBe('2/54')
  // A load is an arrival, not a witness: the restored edges raise no card.
  await root.verifyNoMomentCard()

  // The watermark came back with the edges: the reviewed prefix already
  // implied steam and obsidian, so only fire's smoke still reads as new.
  await root.openFieldNotes()
  const counters = await root.fieldNotesCounters()
  expect(counters.interactions).toContain('2/54')
  expect(counters.fresh).toContain('1')
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
  expect(await root.fieldNotesCount()).toBe('0/54')
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

  await expect.poll(() => root.fieldNotesCount()).toBe('1/54')

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

  await expect.poll(() => root.fieldNotesCount()).toBe('1/54')
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
  expect(await root.fieldNotesCount()).toBe('53/54')
  await root.verifyNoChartCompleteLine()

  await root.selectBrush(2)
  await root.selectElement('dirt')
  await root.paintCell(150, 120)
  await root.selectElement('water')
  await root.paintCell(150, 115)
  await root.step()

  await root.verifyChartCompleteLine()
  await expect.poll(() => root.fieldNotesCount()).toBe('54/54')
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

  expect(await root.fieldNotesCount()).toBe('54/54')
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
  expect(before.elements).toContain('10/21')
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
  const discovered = Number(/(\d+)\/21/.exec(after.elements)?.[1])
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
  expect(await root.fieldNotesCount()).toBe('2/54')

  await root.openFieldNotes()
  // Two of the flower's ten, and no row for the stalk that actually burned.
  // Ten rather than nine since the desert: a blossom's death sheds petals, so
  // `decay:cactus` is on the flower's ring too (ADR 0054).
  expect(await root.noteRow('flower')).toContain('2/10')
  expect(await root.fieldNotesText()).not.toContain('stalk')

  await root.selectNote('flower')
  expect(await root.focusedNote()).toBe('flower')
  expect(await root.noteSpokeCount()).toBe(2)
  expect(await root.noteStillToFind()).toBe('8')
})

/**
 * The ring at the size the roster can actually reach (ticket 09). Fire sits on
 * two tag rows, so its degree grows with the roster - twenty witnessed entries
 * since the desert added a cactus to each of them (ADR 0054) - which is more
 * than the geometry can give a tile each, and the pairs that share a verb and a
 * result merge into stacks rather than overlapping. Screenshot-free
 * on purpose - what is asserted is how many spokes are drawn, what their chips
 * say, and that every pair behind them is still reachable.
 */
test("fire's crowded ring draws as stacks, and every pair stays reachable", async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, entryIndex().witnessKeysFor('fire'))
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  await root.selectNote('fire')
  expect(await root.focusedNote()).toBe('fire')

  // Twenty entries, all of them found - and far fewer lines than that drawn.
  // The drawn count did not move when the desert arrived, which is the grouping
  // doing its job: one new pair joined the stack that was already there, and
  // the other turned `fire + flower` from a lone spoke into a stack of two.
  expect(await root.noteStillToFind()).toBe('0')
  expect(await root.noteDrawnSpokeCount()).toBe(9)
  // Every pair still has its own tile: the crowd moved into the stacks.
  expect(await root.noteSpokeCount()).toBe(20)
  expect(await root.noteGroupCounts()).toEqual(['7/7', '5/5', '2/2'])

  // And a member of a stack is still the way into its own entry, in two steps
  // rather than one since ticket 25: the tile reads the whole group into the
  // band - members listed properly, chip and all, where the merged spoke used
  // to write "…" - and the band is where following happens.
  await root.readSpoke('seed')
  expect(await root.focusedNote()).toBe('fire')
  // Members listed properly where the merged spoke used to write "…", and the
  // chip that says how many pairs like it there are in all.
  expect(await root.readingLine()).not.toContain('…')
  expect(await root.readingLineCount()).toBe('7/7')
  expect(await root.readingLineTiles()).toContain('seed')

  await root.followReadingTile('seed')
  expect(await root.focusedNote()).toBe('seed')
})

/**
 * The band's fixed height (ticket 25), at the width it matters at: a phone.
 * The ring is sized off the viewport here, so a band that grew as a spoke was
 * read would push the ring - and every spoke of it - out from under the finger
 * that had just tapped one.
 */
test('the reading line is the same box empty and read, at phone width', async ({
  mountApp,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await seedWitnessed(page, entryIndex().witnessKeysFor('steam'))
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openFieldNotes()

  // Steam's ring is nearly all arrowheads - six pairs make it, one decay
  // leaves it - and seven spokes are enough to read one after another. The
  // sixth pair is the desert's: a burning cactus steams rather than catching.
  await root.selectNote('steam')
  expect(await root.focusedNote()).toBe('steam')
  expect(await root.noteDrawnSpokeCount()).toBe(7)

  const empty = await root.readingBandHeight()
  expect(await root.readingLine()).toContain('tap a spoke')

  await root.readSpoke('water')
  expect((await root.readingLine()).toLowerCase()).toContain('water')
  expect(await root.readingBandHeight()).toBe(empty)

  await root.readSpoke('lava')
  expect(await root.readingBandHeight()).toBe(empty)
  // A recipe wider than the sheet scrolls inside the band rather than widening
  // it, which is what would push the whole panel sideways.
  await root.verifyReadingLineFitsThePanel()
})
