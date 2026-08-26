import { test } from './testing/iwftTest.tsx'
import type { HomePagePom } from './testing/HomePagePom.ts'

// The laptop scrub strips (boop-playhead ticket 05, spec §4) at the default
// 1280px CT viewport — the song strip above the ruler, the interactive ruler,
// the clip rail in the grid well and the readout in the clip header. Steps are
// hand-cranked on the FakeAudioDriver.

/** Two clips — kick-on-0 and snare-on-0 — placed at song positions 0 and 2 (1 empty). */
async function buildTwoClipSong(root: HomePagePom): Promise<void> {
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.addClip()
  await root.toggleCell('snare', 0)
  await root.toggleLaneSquare(0, 0)
  await root.toggleLaneSquare(1, 2)
}

test('the song strip sits on the lane grid: a cell per position, under its numeral', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  // Every number in the handoff aligns to the lane row's own track, so the
  // check is the alignment rather than a repeat of the pixel values.
  await root.verifyStripCellAlignsWithLane(0, 0)
  await root.verifyStripCellAlignsWithLane(15, 0)

  // Placed cells wear their topmost clip's tint; the rest are the dimmed
  // treatment — drawn, but not on the timeline.
  await root.verifyStripCellPlaced(0, true)
  await root.verifyStripCellPlaced(2, true)
  await root.verifyStripCellPlaced(1, false)
  await root.verifyStripCellPlaced(9, false)

  // Song play is the bar's header, above the strip — not a column beside it.
  await root.verifySongPlayIsTheSongHeader()
})

test('tapping the song strip jumps the song, and playing keeps it playing', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifySongStripMarkerAt(0, 0, true)

  // Bar 3 of position 2 — the second placed position, so global bar 6.
  await root.tapSongStrip(2, 2)
  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifySongStripMarkerAt(2, 2, true)
  await root.verifyPositionPlaying(1, 2)
  await root.verifyPlayheadReadout('Position 3 · bar 3 of 4')
  await root.openClipEditor()
  await root.verifyCellOn('snare', 0)
})

test('an empty cell is not reachable: it resolves forwards, or clamps at the end', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  // Cell 1 is the gap between the two placed positions: forwards, to the start
  // of position 2, so a left-to-right drag never doubles back over it.
  await root.tapSongStrip(1, 0)
  await root.verifySongStripMarkerAt(2, 0, false)
  await root.verifyPlayheadReadout('Position 3 · bar 1 of 4')

  // Cells 3–15 have nothing placed after them, so they clamp to the end of the
  // last placed position (spec §4).
  await root.tapSongStrip(11, 1)
  await root.verifySongStripMarkerAt(2, 3, false)
  await root.verifyPlayheadReadout('Position 3 · bar 4 of 4')

  // And a numeral for an empty position is not a jump at all — a numeral means
  // one position, and an empty one means nothing.
  await root.tapPositionNumeral(0)
  await root.verifySongStripMarkerAt(0, 0, false)
  await root.verifyPositionNumeralUnreachable(11)
})

test('the marker survives a stop at the dimmed treatment, and the next play resumes there', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  // Scrubbed while stopped: silent, and the marker and the grid column both move.
  await root.tapSongStrip(2, 1)
  await root.verifySongStripMarkerAt(2, 1, false)
  await root.openClipEditor()
  await root.verifyPlayheadStoppedAtStep(4)
  // Silent: the scrub moved the state and left the transport alone (spec §4).
  await root.verifySongStopped()
  await root.verifyPaused()

  await root.pressSongPlay()
  await root.crankSteps(1)
  await root.verifySongStripMarkerAt(2, 1, true)
  await root.openClipEditor()
  await root.verifyCellOn('snare', 0)
})

test('dragging the song strip scrubs continuously, and never stops playback', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)

  await root.dragSongStrip({ position: 0, bar: 0 }, { position: 2, bar: 3 })

  // Released where it was dropped, still playing — a scrub never pauses, so
  // there is nothing to resume (spec §2).
  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifySongStripMarkerAt(2, 3, true)
  await root.verifyPlayheadReadout('Position 3 · bar 4 of 4')
})

test('a ruler numeral jumps to the start of its position, and shows it is current', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.tapPositionNumeral(2)
  await root.verifySongStripMarkerAt(2, 0, false)
  await root.verifyPositionNumeralCurrent(2, false)
  await root.verifyPlayheadReadout('Position 3 · bar 1 of 4')

  await root.pressSongPlay()
  await root.crankSteps(1)
  // Playing, the same numeral takes the brighter treatment.
  await root.verifyPositionNumeralCurrent(2, true)
})

test('the clip rail sits on the step columns, snaps to a step, and moves the highlight', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  // The clip rail rides on the grid, so it is inside the editor card.
  await root.openClipEditor()
  await root.verifyClipRailAlignsWithSteps(0)
  await root.verifyClipRailAlignsWithSteps(15)

  await root.tapClipRail(9)
  await root.verifyClipRailAtStep(9, false)
  // The grid's own column and its under-playhead highlight follow the rail.
  await root.verifyPlayheadStoppedAtStep(9)
  await root.verifyActiveBar(2)
  // A step names a bar, so the song strip and the readout move with it.
  await root.verifySongStripMarkerAt(0, 2, false)
  await root.verifyPlayheadReadout('Position 1 · bar 3 of 4')

  await root.dragClipRail(9, 3)
  await root.verifyClipRailAtStep(3, false)
  await root.verifyPlayheadStoppedAtStep(3)
  await root.verifySongStripMarkerAt(0, 0, false)
})

test('a rail drag back over the slot boundary keeps the position it is on', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  // Into the second placed position, past the step-15 swap.
  await root.crankSteps(17)
  await root.verifyPositionPlaying(1, 2)

  // Backwards inside that position: its own clip must come back, not the next.
  await root.tapClipRail(2)
  await root.crankSteps(1)
  await root.verifyPositionPlaying(1, 2)
  await root.verifyCellOn('snare', 0)
  await root.verifyCellOff('kick', 0)
})

test('both strips are sliders: arrows move one unit, Home returns to the start', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.tapSongStrip(2, 0)
  await root.verifySongStripSlider(4, 'Position 3, bar 1')

  await root.pressOnSongStrip('ArrowRight')
  await root.verifySongStripSlider(5, 'Position 3, bar 2')
  await root.pressOnSongStrip('ArrowLeft')
  await root.verifySongStripSlider(4, 'Position 3, bar 1')
  await root.pressOnSongStrip('Home')
  await root.verifySongStripSlider(0, 'Position 1, bar 1')

  await root.pressOnClipRail('ArrowRight')
  await root.verifyClipRailSlider(1, 'Step 2')
  await root.pressOnClipRail('ArrowRight')
  await root.verifyClipRailSlider(2, 'Step 3')
  // Home on the rail goes to the song's start, not the clip's.
  await root.tapSongStrip(2, 2)
  await root.pressOnClipRail('Home')
  await root.verifySongStripSlider(0, 'Position 1, bar 1')
  await root.verifyClipRailSlider(0, 'Step 1')
})

test('a scrub is listening, not editing: the saved chrome and playback are untouched', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  // Save it, so the chrome has something to move off.
  await root.openBoops()
  await root.typeSaveName('Scrub test')
  await root.saveBoop()
  await root.closeBoops()
  await root.verifySavedState('Scrub test')

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)

  // The whole gesture vocabulary of the effort: a tap, a drag, a ruler tap and
  // the clip rail. None of them is an edit (spec §2) and none stops playback.
  await root.tapSongStrip(2, 1)
  await root.dragSongStrip({ position: 2, bar: 1 }, { position: 0, bar: 2 })
  await root.tapPositionNumeral(2)
  await root.tapClipRail(7)
  await root.dragClipRail(7, 1)

  await root.verifySavedState('Scrub test')
  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifySongStripMarkerAt(2, 0, true)
})
