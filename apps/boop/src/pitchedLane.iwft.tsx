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
  // above auditioned their own pitch as they landed, and the step sounds both.
  await root.verifyPlayed([
    { instrumentId: LANE, audioTime: undefined, semitones: 0 },
    { instrumentId: LANE, audioTime: undefined, semitones: 5 },
    { instrumentId: LANE, audioTime: 0.1, semitones: 0 },
    { instrumentId: LANE, audioTime: 0.1, semitones: 5 },
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
})
