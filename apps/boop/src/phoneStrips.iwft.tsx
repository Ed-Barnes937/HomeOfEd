import { test } from './testing/iwftTest.tsx'
import type { HomePagePom } from './testing/HomePagePom.ts'

// The phone scrub bands (boop-playhead ticket 06, spec §4/§7.2) at 390px: the
// existing WHOLE LOOP map becomes the clip scrubber, and a new WHOLE SONG band
// sits between the phone song bar's header and its lanes. Both are the
// non-scrolling kind, which is the loop map's own argument from ADR 0027 — the
// grid and the lanes swipe, the playhead lives somewhere that never moves.

test.use({ viewport: { width: 390, height: 844 } })

/**
 * Two clips — kick-on-0 and snare-on-0 — placed at song positions 0 and 2, so
 * position 1 is a gap. Two placed positions is 8 global bars.
 */
async function buildTwoClipSong(root: HomePagePom): Promise<void> {
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.addClip()
  await root.toggleCell('snare', 0)
  await root.toggleLaneSquare(0, 0)
  await root.toggleLaneSquare(1, 2)
}

test("the loop map's geometry is untouched, and it now scrubs the clip", async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  // Unchanged: all 16 ticks, always, and the window bracket underneath.
  await root.verifyLoopMapCoversWholeLoop()
  await root.verifyLoopWindowBracketAt(0)

  // A tap anywhere on the band moves the playhead to the step under it.
  await root.tapLoopMap(9)
  await root.verifyLoopTick(9, 'playhead')
  await root.verifyLoopMapCapAt(9, false)
  // The grid's own column and its under-playhead highlight follow the band.
  await root.verifyPlayheadStoppedAtStep(9)
  await root.verifyActiveBar(2)
  // A step names a bar, so the song band and the readout move with it.
  await root.verifySongBandMarkerAt(2, false)
  await root.verifyPhonePlayheadReadout('Position 1 · bar 3 of 4')
})

test('dragging the loop map scrubs continuously, and never stops playback', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifyLoopMapCapAt(0, true)

  await root.dragLoopMap(2, 13)

  // Released where it was dropped, still playing — a scrub never pauses (spec §2).
  await root.verifySongPlaying()
  await root.verifyLoopMapCapAt(13, true)
  await root.verifyLoopTick(13, 'playhead')
})

test('the WHOLE SONG band spans the placed positions, one bar wide marker and all', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  // Two placed positions, so two segments — each in its topmost clip's tint.
  await root.verifySongBandSegments([0, 1])
  await root.verifySongBandMarkerAt(0, false)
  await root.verifySongBandMarkerOnSegment(0, 8)

  // Bar 3 of the second placed position is global bar 6 of 8.
  await root.tapSongBand(6, 8)
  await root.verifySongBandMarkerAt(6, false)
  await root.verifySongBandMarkerOnSegment(6, 8)
  await root.verifySongBandCapAt(6, false)
  await root.verifyPhonePlayheadReadout('Position 3 · bar 3 of 4')

  // Playing, the marker and the cap take the bright treatment and the target
  // position is the one that sounds.
  await root.pressSongPlay()
  await root.crankSteps(1)
  await root.verifySongBandMarkerAt(6, true)
  await root.verifySongBandCapAt(6, true)
  await root.verifyPositionPlaying(1, 2)
  await root.verifyCellOn('snare', 0)
})

test('a placement change re-cuts the band without the marker drifting', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.tapSongBand(7, 8)
  await root.verifySongBandMarkerAt(7, false)

  // A third placed position makes it 12 bars over 3 segments. The marker keeps
  // its bar and re-derives its width, so it lands on the same segment.
  await root.toggleLaneSquare(0, 5)
  await root.verifySongBandSegments([0, 1, 0])
  await root.verifySongBandMarkerAt(7, false)
  await root.verifySongBandMarkerOnSegment(7, 12)

  // And taking the last placed position away shortens the timeline under the
  // playhead: it clamps to the end rather than pointing off the band.
  await root.toggleLaneSquare(0, 5)
  await root.toggleLaneSquare(1, 2)
  await root.verifySongBandSegments([0])
  await root.verifySongBandMarkerAt(3, false)
  await root.verifySongBandMarkerOnSegment(3, 4)
})

test('dragging the song band scrubs continuously and stays audible', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)

  await root.dragSongBand(0, 7, 8)

  await root.verifySongPlaying()
  await root.crankSteps(1)
  await root.verifySongBandMarkerAt(7, true)
  await root.verifyPhonePlayheadReadout('Position 3 · bar 4 of 4')
})

test('both bands are sliders: arrows move one unit, Home returns to the start', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.tapSongBand(4, 8)
  await root.verifySongBandSlider(4, 'Position 3, bar 1')

  await root.pressOnSongBand('ArrowRight')
  await root.verifySongBandSlider(5, 'Position 3, bar 2')
  await root.pressOnSongBand('ArrowLeft')
  await root.verifySongBandSlider(4, 'Position 3, bar 1')
  await root.pressOnSongBand('Home')
  await root.verifySongBandSlider(0, 'Position 1, bar 1')

  await root.pressOnLoopMap('ArrowRight')
  await root.verifyLoopMapSlider(1, 'Step 2')
  await root.pressOnLoopMap('ArrowRight')
  await root.verifyLoopMapSlider(2, 'Step 3')
  // Home on the clip's band goes to the start of the *song* (spec §4).
  await root.tapSongBand(6, 8)
  await root.pressOnLoopMap('Home')
  await root.verifySongBandSlider(0, 'Position 1, bar 1')
  await root.verifyLoopMapSlider(0, 'Step 1')
})

test('neither band scrolls, both clear 44px, and the region still pans vertically', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.verifyBandTapTargets()
  // The bands must not claim vertical panning from the one scroller (ADR 0030).
  await root.verifyBandsAllowVerticalScroll()
  await root.verifyGridRegionIsTheOnlyScroller()

  // The grid and the lanes swipe; the bands stay exactly where they were.
  await root.verifyBandsDoNotScroll(300)
  await root.verifyStepWindowAt(308)
  await root.verifyLaneWindowAt(308)
  await root.verifyNoHorizontalOverflow()
})

test('a drag down a band scrolls the page rather than scrubbing it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  // Park the playhead somewhere findable first.
  await root.tapSongBand(2, 8)
  await root.verifySongBandMarkerAt(2, false)
  await root.verifyPlayheadStoppedAtStep(8)

  // A drag *down* either band is the page-scroll gesture, and on real touch
  // hardware it reaches us as `pointermove`s before the browser claims it. Only
  // a sideways drag is a scrub, so neither band may move the playhead here —
  // even though both drags start well away from where it sits.
  await root.dragDownBand('song')
  await root.verifySongBandMarkerAt(2, false)

  await root.dragDownBand('loop')
  await root.verifySongBandMarkerAt(2, false)
  await root.verifyPlayheadStoppedAtStep(8)
})

test('a phone scrub is listening, not editing: the saved chrome and playback are untouched', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await buildTwoClipSong(root)

  await root.pressPhoneSave()
  await root.typeSaveName('Phone scrub')
  await root.saveBoop()
  await root.closeBoops()

  await root.pressSongPlay()
  await root.verifySongPlaying()
  await root.crankSteps(1)

  await root.tapSongBand(5, 8)
  await root.dragSongBand(5, 1, 8)
  await root.tapLoopMap(7)
  await root.dragLoopMap(7, 1)

  await root.verifyPhoneSavedDot(false)
  await root.verifySongPlaying()
})
