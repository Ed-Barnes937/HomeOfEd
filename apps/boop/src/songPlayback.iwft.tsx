import { test } from './testing/iwftTest.tsx'
import { CRANK_STEP_SECONDS, type HomePagePom } from './testing/HomePagePom.ts'

// Song playback: the conductor (boop-loops ticket 16, spec §9), at the default
// 1280px CT viewport — the song bar only exists on the laptop layout. Steps
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
