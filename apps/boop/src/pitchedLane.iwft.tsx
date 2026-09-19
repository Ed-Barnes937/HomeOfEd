import { expect } from '@playwright/experimental-ct-react'

import { routePitchedKit } from './testing/pitchedKit.ts'
import { test } from './testing/iwftTest.tsx'

// Nothing in the shipped kit is pitched yet (spec §11 - ticket 10 activates the
// roster), so every lane test here flags one instrument for its own page load.
// `marimba` because it is one of the conversions the spec names, and it is in
// the blank clip's default six.
const LANE = 'marimba'

test('a pitched row is a lane of eight notes, and the drum rows are untouched', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyIsLane(LANE)
  await root.verifyCellOff('kick', 0)
  // The plate bleeds 8px past the end columns; the well's scroll padding is
  // what holds it, exactly as it holds the playhead column's overhang.
  await root.verifyGridWellHasNoSidewaysScroll()
})

test('a tap paints that note, and a second tap in the column adds a chord', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.paintNote(LANE, 0, 4)
  await root.verifyNoteOn(LANE, 0, 4)

  await root.paintNote(LANE, 0, 7)
  await root.verifyNoteOn(LANE, 0, 4)
  await root.verifyNoteOn(LANE, 0, 7)

  await root.pressPlay()
  await root.verifyPlaying()
  await root.fireStep()
  // Each note transposed from the anchor "so", low note first: the two paints
  // above auditioned their own pitch as they landed at full level, and the
  // step sounds both, sharing one voice's worth of gain (ADR 0062).
  const chord = 1 / Math.sqrt(2)
  await root.verifyPlayed([
    { instrumentId: LANE, audioTime: undefined, semitones: 0 },
    { instrumentId: LANE, audioTime: undefined, semitones: 5 },
    { instrumentId: LANE, audioTime: 0.1, semitones: 0, gain: chord },
    { instrumentId: LANE, audioTime: 0.1, semitones: 5, gain: chord },
  ])
})

test('tapping a painted note clears that note and leaves the rest of the chord', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.paintNote(LANE, 2, 1)
  await root.paintNote(LANE, 2, 6)
  await root.paintNote(LANE, 2, 1)

  await root.verifyNoteOff(LANE, 2, 1)
  await root.verifyNoteOn(LANE, 2, 6)
})

test('a drag down the column fills every cell it crosses', async ({ mountApp, page }) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.dragLane(LANE, 5, 6, 3)

  for (const pitchIndex of [6, 5, 4, 3]) await root.verifyNoteOn(LANE, 5, pitchIndex)
  await root.verifyNoteOff(LANE, 5, 7)
  await root.verifyNoteOff(LANE, 5, 2)
})

test('a painted note under the playhead wears the ring', async ({ mountApp, page }) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.paintNote(LANE, 1, 2)
  await root.pressPlay()
  await root.verifyPlaying()
  await root.crankSteps(2)

  await root.verifyPlayheadAtStep(1)
  await root.verifyNoteUnderPlayhead(LANE, 1, 2)
})

test('the arrow keys walk the lane, spill into the row above it, and Enter paints', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.focusNote(LANE, 3, 4)
  await root.pressArrowKey('ArrowUp')
  await root.verifyNoteFocused(LANE, 3, 5)

  await root.pressArrowKey('ArrowRight')
  await root.verifyNoteFocused(LANE, 4, 5)

  await root.pressEnter()
  await root.verifyNoteOn(LANE, 4, 5)

  await root.pressBackspace()
  await root.verifyNoteOff(LANE, 4, 5)

  // The top of the lane is the top of the row: one more step up leaves it.
  await root.focusNote(LANE, 4, 7)
  await root.pressArrowKey('ArrowUp')
  await root.verifyCellFocused('tom', 4)
})

test('every lane cell is announced by its solfège name', async ({ mountApp, page }) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyNoteLabel(LANE, 4, 4, 'so, step 5, off')
  await root.paintNote(LANE, 4, 7)
  await root.verifyNoteLabel(LANE, 4, 7, 'high do, step 5, on')
  await root.verifyNoteLabel(LANE, 0, 0, 'do, step 1, off')
})

test('the shipped kit has no pitched instrument, so no row is a lane', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyCellOff(LANE, 0)
  await expect(root.laneCell(LANE, 0, 4)).toHaveCount(0)
  await expect(root.laneToggle(LANE)).toHaveCount(0)
})

// ---- Collapse (ticket 07) ----
//
// Several 220px lanes make a clip unscannable, so a pitched row folds to the
// handoff's pebble summary. It is UI-only state (spec §4, grill Q8): rows open
// expanded, and nothing about it reaches `saveFormat.ts`.

test('the chevron folds a lane down to its pebbles, and opens it again', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.paintNote(LANE, 0, 6)
  await root.verifyLaneExpanded(LANE)

  await root.toggleLane(LANE)
  await root.verifyLaneCollapsed(LANE)
  await root.verifyPebbleShown(LANE, 0, 6)
  await root.verifyNoPebble(LANE, 0, 5)
  await root.verifyNoPebble(LANE, 1, 6)

  await root.toggleLane(LANE)
  await root.verifyLaneExpanded(LANE)
  await root.verifyNoteOn(LANE, 0, 6)
})

test('a chord shows a pebble per note, stacked by pitch, and the rail draws the contour', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.paintNote(LANE, 1, 0)
  await root.paintNote(LANE, 1, 4)
  await root.paintNote(LANE, 9, 7)
  await root.toggleLane(LANE)

  await root.verifyPebbleShown(LANE, 1, 0)
  await root.verifyPebbleShown(LANE, 1, 4)
  await root.verifyPebbleAbove(LANE, 1, 4, 0)

  // Bar 1 holds the chord's mean, bar 3 its one high note, and the empty bars
  // draw nothing.
  await root.verifyContourBar(LANE, 0, 2)
  await root.verifyContourBar(LANE, 1, 'off')
  await root.verifyContourBar(LANE, 2, 7)
  await root.verifyContourBar(LANE, 3, 'off')
})

test('the playhead sweeps a collapsed row on the same columns as the rest', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleLane(LANE)
  await root.pressPlay()
  await root.verifyPlaying()
  await root.crankSteps(3)

  await root.verifyPlayheadAtStep(2)
  await root.verifySummaryUnderPlayhead(LANE, 2)
})

test('the summary is read-only, and the keys step over a folded row', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleLane(LANE)
  await expect(root.laneSummaryCell(LANE, 3).getByRole('button')).toHaveCount(0)

  // Nothing in the summary takes focus, so an arrow into a folded row carries
  // on to the next one rather than stranding the cursor.
  await root.focusCell('tom', 3)
  await root.pressArrowKey('ArrowDown')
  await root.verifyCellFocused('boop', 3)
})

// ---- Tapping a folded row opens it (ticket 12, ADR 0061 as amended) ----

test('a tap anywhere on a folded row opens it, and paints nothing', async ({ mountApp, page }) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleLane(LANE)
  await root.verifyLaneCollapsed(LANE)

  await root.tapFoldedRow(LANE, 3)

  await root.verifyLaneExpanded(LANE)
  for (const pitchIndex of [0, 1, 2, 3, 4, 5, 6, 7]) {
    await root.verifyNoteOff(LANE, 3, pitchIndex)
  }
})

test('a tap on a pebble opens the row too', async ({ mountApp, page }) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.paintNote(LANE, 5, 6)
  await root.toggleLane(LANE)
  await root.tapPebble(LANE, 5, 6)

  await root.verifyLaneExpanded(LANE)
  await root.verifyNoteOn(LANE, 5, 6)
})

test('the folded row is still one control, and it is the chevron', async ({ mountApp, page }) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleLane(LANE)
  await root.verifyFoldedRowIsOneControl(LANE, 'Expand the Marimba row')
})

test('collapse is one row at a time', async ({ mountApp, page }) => {
  await routePitchedKit(page, [LANE, 'boop'])
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleLane(LANE)
  await root.verifyLaneCollapsed(LANE)
  await root.verifyLaneExpanded('boop')
})

test('the chevron is reachable and announced by what it does to the row', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyLaneToggleLabel(LANE, 'Collapse the Marimba row')
  await root.laneToggle(LANE).focus()
  await expect(root.laneToggle(LANE)).toBeFocused()

  await root.pressEnter()
  await root.verifyLaneCollapsed(LANE)
  await root.verifyLaneToggleLabel(LANE, 'Expand the Marimba row')
})

test('a reload opens every row again, and collapsing never reached the save', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const first = await mountApp()
  await first.root.verifyIsShown()
  await first.root.startBlank()

  await first.root.paintNote(LANE, 7, 2)
  await first.root.waitForAutosavedCell(LANE, 7)
  const beforeCollapse = await first.root.readAutosavedGrid()

  await first.root.toggleLane(LANE)
  await first.root.verifyLaneCollapsed(LANE)
  expect(await first.root.readAutosavedGrid()).toEqual(beforeCollapse)

  await page.reload()
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()

  await root.verifyLaneExpanded(LANE)
  await root.verifyNoteOn(LANE, 7, 2)
})
