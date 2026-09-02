import { test } from './testing/iwftTest.tsx'

// The tablet band (boop-loops ticket 20, spec §4 — variant E): between 1024
// and 1279px the whole clip-lanes experience works with no sideways scroll
// anywhere. The laptop song bar, pinned as designed, but the lane grid shrinks
// to fit the column instead of scrolling — flexible squares, 128px chips,
// ruler numerals compressing with the squares. Everything else follows the
// laptop design.

test.use({ viewport: { width: 1100, height: 800 } })

test('the clip-lanes chrome replaces the old transport at tablet widths', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyNoTransportBar()
  // The laptop pieces are all here: Speed and song play in the song bar, New
  // boop in the top bar, and — inside the card the launcher opens — the clip
  // header over the grid and the clip control in the well.
  await root.verifyPaused()
  await root.verifyTempo(100)
  await root.verifySongLength('0 bars')
  await root.verifyLauncherClip('Boom clap') // the first-visit seed
  await root.openClipEditor()
  await root.verifyActiveClipName('Boom clap')
  await root.pressNewBoop()
  await root.openClipEditor()
  await root.verifyCellOff('kick', 0)
})

test('the lane grid fits the column, even at the five-clip cap', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyLaneGridFitsColumn()
  await root.verifyNoPlacementHint()

  await root.addClip()
  await root.addClip()
  await root.addClip()
  await root.addClip()
  await root.verifyClipCount(5)
  await root.verifyAddClipDisabled()

  await root.verifyLaneGridFitsColumn()
  await root.verifyNoSidewaysScroller()
  // The dock is pinned and the song bar's lanes scroll inside their own box —
  // five lanes fill the region, they don't unpin anything, and at this width
  // nothing else has to scroll at all.
  await root.verifyLauncherFullyInViewport()
  await root.verifyNothingIsScrolled()

  // A copy is a new clip too, so the cap greys it the same way — and the grid
  // the card opens on is whole: five lanes cost it nothing now that the two
  // surfaces are not sharing the frame.
  await root.openClipEditor()
  await root.verifyCopyClipDisabled()
  await root.verifyNotOccluded('play-button')
  await root.verifyPageDoesNotScroll()
})

test('placements, clip switching and reordering work unchanged at this width', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.addClip()
  await root.toggleCell('snare', 0)

  await root.toggleLaneSquare(0, 0)
  await root.toggleLaneSquare(1, 2)
  await root.verifyPlacementOn(0, 0)
  await root.verifyPlacementOn(1, 2)
  await root.verifySongLength('8 bars')

  await root.selectClip(0)
  await root.verifyClipChipActive(0)
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOff('snare', 0)

  await root.reorderChipByKeyboard(0, 'down')
  await root.verifyClipChipName(0, 'Clip 2')
  await root.verifyClipChipName(1, 'Clip 1')
  // Placements travelled with their clips.
  await root.verifyPlacementOn(1, 0)
  await root.verifyPlacementOn(0, 2)

  // Clip management — rename, copy, delete — is the laptop's, unchanged.
  // The active clip (Clip 1) travelled with the reorder, so it is lane 1 now.
  await root.renameActiveClip('Thunder')
  await root.verifyClipChipName(1, 'Thunder')
  await root.copyClip()
  await root.verifyClipCount(3)
  await root.deleteClip()
  await root.verifyClipCount(2)
})

test('the playing ring walks the lane squares as the song plays', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.addClip()
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
})

test('the new scrub rows fit the band: strip cells still track the squares', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.toggleLaneSquare(0, 0)
  await root.toggleLaneSquare(0, 15)

  // The song strip compresses with the lane grid rather than pushing the
  // column into a sideways scroll.
  await root.verifyStripCellAlignsWithLane(0, 0)
  await root.verifyStripCellAlignsWithLane(15, 0)
  await root.verifyNoSidewaysScroller()
  await root.tapSongStrip(15, 2)
  await root.verifySongStripMarkerAt(15, 2, false)

  // The clip rail (boop-playhead ticket 05) rides on the grid, so it is inside
  // the card — same alignment question, asked where the rail now lives.
  await root.openClipEditor()
  await root.verifyClipRailAlignsWithSteps(0)
  await root.verifyClipRailAlignsWithSteps(15)
  await root.tapClipRail(6)
  await root.verifyClipRailAtStep(6, false)
})

// The band used to compress the squares to their 20px floor at every width in
// it, however much room the row had — the lane grid took its content's minimum
// width instead of the row's. At 1100 the laptop's own 44px square fits.
test('the squares are only as small as the width forces', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.addClip()

  await root.verifyLaneSquareWidthAtLeast(40)
  await root.verifyLaneGridFitsColumn()
  await root.verifyNoSidewaysScroller()
})

test.describe('1024 — the narrow end, where the band really does compress', () => {
  test.use({ viewport: { width: 1024, height: 800 } })

  test('the squares share out the column exactly, flush with its edge', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.startBlank()
    await root.addClip()

    await root.verifyLaneGridFitsColumn({ expectFlush: true })
    await root.verifyNoSidewaysScroller()
    await root.verifyStripCellAlignsWithLane(15, 0)
  })
})
