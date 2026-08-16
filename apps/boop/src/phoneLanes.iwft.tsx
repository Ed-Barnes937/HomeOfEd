import { test } from './testing/iwftTest.tsx'

// Phone clip lanes (boop-loops ticket 21, spec §5 — variant B): at ≤1023px the
// song bar lives *inside the scrolling region*, below the grid well — nothing
// new is pinned (ADR 0030's default home). The phone keeps its pinned
// transport bar: clip play and Speed stay there. Lanes reuse the step window's
// exact geometry so lane squares align column-for-column under the grid, and
// placements follow PhoneGrid's paint-vs-scroll rules (ADR 0027).

test.use({ viewport: { width: 390, height: 844 } })

test('the song bar renders in the scrolling region; nothing new is pinned', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPhoneChromeShown()
  await root.startBlank()

  await root.verifySongBarInsideGridRegion()
  await root.verifySongLength('0 bars')

  // The pinned transport keeps clip play and Speed (spec §5).
  await root.verifyTransportFullyInViewport()
  await root.verifyTempo(100)

  // Even at the five-clip cap the lanes grow the scrolling region, never a
  // pinned bar: the grid region stays the only scroller (ADR 0030) and the
  // page never scrolls sideways.
  await root.addClip()
  await root.addClip()
  await root.addClip()
  await root.addClip()
  await root.verifyClipCount(5)
  await root.verifyTransportFullyInViewport()
  await root.verifyGridRegionIsTheOnlyScroller()
  await root.verifyNoHorizontalOverflow()
})

test('lane squares align column-for-column with the step window, and the strip snaps to bar lines', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  // Both windows at rest: a lane square sits exactly under its grid column.
  await root.verifyLaneSquareAlignedUnderCell(0)
  await root.verifyLaneSquareAlignedUnderCell(5)

  // A swipe past the second bar line settles on the third — the step window's
  // own snap point (8 x 32 + 6 x 5 + 2 x 11), never half a bar.
  await root.swipeLanes(300)
  await root.verifyLaneWindowAt(308)
})

test('the lane window leaves room for its squares’ focus rings', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyFocusRingsFitTheScrollBox('phone-lane-window')
  // The room changed nothing on screen: the columns still line up.
  await root.verifyLaneSquareAlignedUnderCell(0)
  await root.verifyLaneSquareAlignedUnderCell(15)
})

test('placements follow the phone paint-vs-scroll rules', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  // A tap toggles one square.
  await root.toggleLaneSquare(0, 0)
  await root.verifyPlacementOn(0, 0)
  await root.verifySongLength('4 bars')
  await root.toggleLaneSquare(0, 0)
  await root.verifyPlacementOff(0, 0)

  // A drag that crosses a square boundary paints, latched from the first square.
  await root.dragPaintLanes(0, [1, 2, 3])
  await root.verifyPlacementOn(0, 1)
  await root.verifyPlacementOn(0, 2)
  await root.verifyPlacementOn(0, 3)
  // Painting is not scrolling: the lane window did not move.
  await root.verifyLaneWindowAt(0)

  // And a sideways swipe scrolls — it paints nothing on the way past.
  await root.swipeLanes(300)
  await root.verifyLaneWindowAt(308)
  await root.verifyPlacementOff(0, 8)
  await root.verifyPlacementOff(0, 9)
})

test('song play works from the song bar header and the playing ring walks the lanes', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.addClip()
  await root.toggleCell('snare', 0)
  await root.toggleLaneSquare(0, 0)
  await root.toggleLaneSquare(1, 1)

  await root.pressSongPlay()
  await root.verifySongPlaying()

  await root.crankSteps(1)
  await root.verifyPositionPlaying(0, 0)
  await root.verifyPositionNumeralPlaying(0)

  await root.crankSteps(16)
  await root.verifyPositionPlaying(1, 1)
  await root.verifyPositionNumeralPlaying(1)

  // The transport's play is *clip* play (spec §9): it takes over from the
  // song without stopping the transport.
  await root.pressPlay()
  await root.verifySongStopped()
  await root.verifyPlaying()
  await root.verifyNoPositionPlaying()
})

test('compact chips select clips, "+ New" caps at five, and the slim header carries rename, copy and delete', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.addClip()
  await root.toggleCell('snare', 0)
  await root.verifyClipChipActive(1)

  await root.selectClip(0)
  await root.verifyClipChipActive(0)
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOff('snare', 0)

  // The ×n count on a compact chip.
  await root.toggleLaneSquare(0, 0)
  await root.toggleLaneSquare(0, 1)
  await root.verifyChipPlacementCount(0, '×2')

  // The slim clip header, in the scroller above the grid well.
  await root.renameActiveClip('Thunder')
  await root.verifyClipChipName(0, 'Thunder')
  await root.copyClip()
  await root.verifyClipCount(3)
  await root.deleteClip()
  await root.verifyClipCount(2)

  await root.addClip()
  await root.addClip()
  await root.addClip()
  await root.verifyClipCount(5)
  await root.verifyAddClipDisabled()
  await root.verifyCopyClipDisabled()
})
