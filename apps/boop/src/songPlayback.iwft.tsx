import { test } from './testing/iwftTest.tsx'
import { CRANK_STEP_SECONDS, type HomePagePom } from './testing/HomePagePom.ts'

// Song playback: the conductor (boop-loops ticket 16, spec §9), at the default
// 1280px CT viewport — the song bar only exists on the clip-lanes layouts. Steps
// are hand-cranked on the FakeAudioDriver: `crankSteps` fires schedule and
// draw together; `fireStep` + `advanceDrawClock` pull them apart to observe
// the schedule-time lookahead.

/** Two clips — kick-on-0 and snare-on-0 — placed at song positions 0 and 2 (1 empty). */
async function buildTwoClipSong(root: HomePagePom): Promise<void> {
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.addClip()
  await root.toggleCell('snare', 0)
  await root.toggleLaneSquare(0, 0)
  await root.toggleLaneSquare(1, 2)
}

test('the song plays placements left to right, skips empty positions, and loops', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()

  // Position 0 sounds: its ring is on and the grid shows its clip.
  await root.crankSteps(1)
  await root.verifyPositionPlaying(0, 0)
  await root.verifyPositionNumeralPlaying(0)
  await root.verifyClipChipActive(0)
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOff('snare', 0)

  // Position 1 is empty — after 16 steps the song is at position 2, not 1.
  await root.crankSteps(16)
  await root.verifyPositionPlaying(1, 2)
  await root.verifyClipChipActive(1)
  await root.verifyCellOn('snare', 0)
  await root.verifyCellOff('kick', 0)

  // ...and the whole song loops back to position 0.
  await root.crankSteps(16)
  await root.verifyPositionPlaying(0, 0)
  await root.verifyCellOn('kick', 0)
})

test('a layered position rings on every lane in it and shows its topmost clip', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.addClip()
  await root.toggleCell('snare', 0)

  // Both clips in the one column — they sound together, and the column is
  // still one position: 4 bars, not 8.
  await root.toggleLaneSquare(0, 0)
  await root.toggleLaneSquare(1, 0)
  await root.verifySongLength('4 bars')

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)

  await root.verifyPositionPlaying(0, 0)
  await root.verifyPositionPlaying(1, 0)
  // The grid can only show one clip: the layered column's topmost lane.
  await root.verifyClipChipActive(0)
  await root.verifyCellOn('kick', 0)

  // A one-position song loops on itself, still ringing on both lanes.
  await root.crankSteps(16)
  await root.verifyPositionPlaying(0, 0)
  await root.verifyPositionPlaying(1, 0)
})

test('the grid follows the draw channel: no early flash of the next clip at the swap', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(16) // steps 0–15 heard; the swap is already *scheduled*

  // Step 16 is scheduled (the engine holds the next clip) but has not sounded:
  // the grid and the ring must still show position 0.
  await root.fireStep()
  await root.verifyCellOn('kick', 0)
  await root.verifyPositionPlaying(0, 0)

  // Only once the draw clock reaches it does the grid switch.
  await root.advanceDrawClock(17 * CRANK_STEP_SECONDS)
  await root.verifyCellOn('snare', 0)
  await root.verifyPositionPlaying(1, 2)
})

test('one mode at a time: each play stops the other, and a chip tap stops the song', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.verifyPaused() // the clip control reads not-playing during song play

  // "Play this clip" takes over: the song ends, the clip keeps looping.
  await root.pressPlay()
  await root.verifySongStopped()
  await root.verifyPlaying()

  // And the song play takes back over from the clip loop.
  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.verifyPaused()

  // Tapping a chip while the song plays stops it outright — editing now.
  await root.selectClip(0)
  await root.verifySongStopped()
  await root.verifyPaused()
  await root.verifyPlayheadHidden()
  await root.verifyNoPositionPlaying()
})

test('song play begins at the leftmost placement, even taking over a running clip loop', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  // A clip loop already running, part way through its bars.
  await root.pressPlay()
  await root.verifyPlaying()
  await root.crankSteps(8)
  await root.verifyPlayheadAtStep(7)

  // The song takes over: from position 0, from its first step (ticket 22).
  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifyPositionPlaying(0, 0)
  await root.verifyPlayheadAtStep(0)
  await root.verifyCellOn('kick', 0)

  // ...and the clip takes back over the same way.
  await root.crankSteps(4)
  await root.verifyPlayheadAtStep(4)
  await root.pressPlay()
  await root.verifySongStopped()
  await root.verifyPlaying()
  await root.crankSteps(1)
  await root.verifyPlayheadAtStep(0)
})

test('a grid edit during song play stops the song and lands in the clip on screen', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifyClipChipActive(0)

  await root.toggleCell('snare', 4)
  await root.verifySongStopped()
  await root.verifyPaused()
  // The edit went into the sounding clip — the one the child was looking at.
  await root.verifyClipChipActive(0)
  await root.verifyCellOn('snare', 4)
  await root.selectClip(1)
  await root.verifyCellOff('snare', 4)
})

test('an all-empty song plays the clip on the grid — no ring, still the song button', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('kick', 0)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifyPlayheadAtStep(0)
  await root.verifyNoPositionPlaying()

  await root.pressSongPlay()
  await root.verifySongStopped()
  await root.verifyPlayheadHidden()
})

test('speed changes mid-song take effect without stopping it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)

  await root.setTempoPercent(80)
  await root.verifyTempo(157)
  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifyPositionPlaying(0, 0)
})
