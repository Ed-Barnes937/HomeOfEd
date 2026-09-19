import { test } from './testing/iwftTest.tsx'
import { routePitchedKit } from './testing/pitchedKit.ts'

// The pitched lane on the phone (ticket 08, ADR 0063). Nothing in the shipped
// kit is pitched yet (spec §11), so every test here flags its own instrument.

const LANE = 'marimba'
const OTHER_LANE = 'boop'

test.use({ viewport: { width: 390, height: 844 } })

test("a pitched row is a lane on the phone, on the grid's own step columns", async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyIsLane(LANE)
  await root.verifyCellOff('kick', 0)
  await root.verifyCellGeometry(32, 44)
  await root.verifyLaneColumnOnStepColumn(LANE, 'kick', 0)
  await root.verifyLaneColumnOnStepColumn(LANE, 'kick', 15)
  await root.verifyPitchedRowAligns(LANE)
  // The plate takes no horizontal bleed here, so the snap offsets still
  // describe the strip the window has.
  await root.verifyStepStripIsNotOverhung()
  await root.verifyNoHorizontalOverflow()
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

  await root.paintNote(LANE, 0, 4)
  await root.verifyNoteOff(LANE, 0, 4)
  await root.verifyNoteOn(LANE, 0, 7)
})

test('a drag down the column fills every cell it crosses, and scrolls nothing', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.dragLane(LANE, 2, 6, 3)

  for (const pitchIndex of [6, 5, 4, 3]) await root.verifyNoteOn(LANE, 2, pitchIndex)
  await root.verifyNoteOff(LANE, 2, 7)
  await root.verifyNoteOff(LANE, 2, 2)
  await root.verifyStepWindowAt(0)
})

test('a finger that settles before it drags still keeps the note it landed on', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.dragLaneFromRest(LANE, 7, 3, 5)

  for (const pitchIndex of [3, 4, 5]) await root.verifyNoteOn(LANE, 7, pitchIndex)
  await root.verifyNoteOff(LANE, 7, 2)
  await root.verifyNoteOff(LANE, 7, 6)
})

test('a press that never leaves its note paints nothing', async ({ mountApp, page }) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.pressAndWanderOffTheLane(LANE, 5, 4)

  for (const pitchIndex of [3, 4, 5]) await root.verifyNoteOff(LANE, 5, pitchIndex)
})

test('the step window still snaps to bar lines with a lane on it, and the swipe paints nothing', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.verifyStepWindowAt(0)

  await root.swipeSteps(300)
  await root.verifyStepWindowAt(308)
  await root.verifyLoopWindowBracketAt(50)

  await root.paintNote(LANE, 9, 6)
  await root.verifyNoteOn(LANE, 9, 6)
  for (const step of [4, 8]) await root.verifyNoteOff(LANE, step, 6)
})

test('the lane takes no gesture from the window or the rail, and adds no scroll box', async ({
  mountApp,
  page,
}) => {
  // Two lanes is what makes the rows box overflow at this height, which is the
  // state the gesture question is really about.
  await routePitchedKit(page, [LANE, OTHER_LANE])
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyLaneLeavesTheScrollGesturesAlone(LANE)
  await root.verifyGridScrollBoxes(['phone-step-window'])
  // The rows box is still the one that gives, and scrolling it leaves the
  // step window's own position alone.
  await root.verifyGridWellIsTheScroller()
  await root.scrollGridWellToBottom()
  await root.verifyStepWindowAt(0)
})

test('the chevron folds the lane to its pebbles and hands the rows back', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.paintNote(LANE, 0, 6)
  await root.paintNote(LANE, 0, 1)
  await root.verifyLaneExpanded(LANE)
  const expanded = await root.readRowsHeight()

  await root.toggleLane(LANE)
  await root.verifyLaneCollapsed(LANE)
  await root.verifyPitchedRowAligns(LANE)
  await root.verifyPebbleShown(LANE, 0, 6)
  await root.verifyPebbleShown(LANE, 0, 1)
  await root.verifyPebbleAbove(LANE, 0, 6, 1)
  await root.verifyNoPebble(LANE, 1, 6)
  await root.verifyContourBar(LANE, 0, 4)

  const collapsed = await root.readRowsHeight()
  if (collapsed >= expanded) throw new Error('folding a lane gave the rows box nothing back')

  await root.toggleLane(LANE)
  await root.verifyLaneExpanded(LANE)
  await root.verifyNoteOn(LANE, 0, 6)
})

// ---- Tapping a folded row opens it (ticket 12) ----

test('a tap on a folded row opens it, and a pan that starts there still pans', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleLane(LANE)
  await root.verifyLaneCollapsed(LANE)

  await root.panAcrossFoldedRow(LANE, 1)
  await root.verifyLaneCollapsed(LANE)
  await root.swipeSteps(300)
  await root.verifyStepWindowAt(308)
  await root.verifyLaneCollapsed(LANE)

  await root.tapFoldedRow(LANE, 9)
  await root.verifyLaneExpanded(LANE)
  for (const pitchIndex of [0, 1, 2, 3, 4, 5, 6, 7]) {
    await root.verifyNoteOff(LANE, 9, pitchIndex)
  }
})

test('a folded row adds no second control for the keyboard or a screen reader', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleLane(LANE)
  await root.verifyFoldedRowIsOneControl(LANE, 'Expand the Marimba row')
})

test('the playhead sweeps a pitched row the swipe has left behind, and the map carries it', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.paintNote(LANE, 0, 2)
  await root.swipeSteps(300)
  await root.verifyStepWindowAt(308)

  await root.pressPlay()
  await root.verifyPlaying()
  await root.fireStep()
  await root.advanceDrawClock(0.1)

  await root.verifyLoopTick(0, 'playhead')
  await root.verifyPlayheadEdgeGlow('left')
  // Playback never scrolls for the child, on either axis (ADR 0042).
  await root.verifyStepWindowAt(308)
  await root.verifyGridRowsNotScrolled()
})

test('a folded row still takes the playhead column', async ({ mountApp, page }) => {
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

test('Enter on a focused note paints that note and only that note', async ({ mountApp, page }) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  // A keyboard click fires on the tile and passes through the column that
  // carries the lane's pointer hits; only the tile's own toggle may land.
  await root.focusNote(LANE, 6, 2)
  await root.pressEnter()

  await root.verifyNoteOn(LANE, 6, 2)
  for (const pitchIndex of [0, 4, 7]) await root.verifyNoteOff(LANE, 6, pitchIndex)
})

test('the chevron is a 44px control, and the lane is announced in solfège', async ({
  mountApp,
  page,
}) => {
  await routePitchedKit(page, LANE)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyLaneToggleLabel(LANE, 'Collapse the Marimba row')
  await root.verifyLaneToggleTapTarget(LANE)
  await root.verifyNoteLabel(LANE, 4, 4, 'so, step 5, off')
  await root.paintNote(LANE, 4, 7)
  await root.verifyNoteLabel(LANE, 4, 7, 'high do, step 5, on')
})

// ADR 0030's own sizes, with the lane on them. A pitched row is ~3.5 drum rows,
// so two of them is the worst case the frame has to hold: the page must not
// scroll and clip play must stay reachable inside the well.
for (const height of [844, 640, 505, 420, 380]) {
  test.describe(`the frame holds two lanes at 390x${height}`, () => {
    test.use({ viewport: { width: 390, height } })

    test('the page does not scroll and clip play stays reachable', async ({ mountApp, page }) => {
      await routePitchedKit(page, [LANE, OTHER_LANE])
      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.startBlank()

      await root.verifyIsLane(LANE)
      await root.verifyIsLane(OTHER_LANE)
      await root.verifyStageIsAFixedFrame()
      await root.verifyClipPlayInWellIsReachable()
      await root.verifyGridScrollBoxes(['phone-step-window'])

      // Folded, both rows are back inside a phone's worth of grid.
      await root.toggleLane(LANE)
      await root.toggleLane(OTHER_LANE)
      await root.verifyStageIsAFixedFrame()
      await root.verifyClipPlayInWellIsReachable()
    })
  })
}
