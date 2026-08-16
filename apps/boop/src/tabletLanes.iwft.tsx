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
  // The laptop pieces are all here: the clip header over the grid, the clip
  // control in the well, Speed in the song bar, New boop in the top bar.
  await root.verifyActiveClipName('Boom clap') // the first-visit seed
  await root.verifyPaused()
  await root.verifyTempo(100)
  await root.verifySongLength('0 bars')
  await root.pressNewBoop()
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
  await root.verifyCopyClipDisabled()

  await root.verifyLaneGridFitsColumn()
  await root.verifyNoSidewaysScroller()
  // The song bar is pinned and the grid region is still the only scroller
  // (ADR 0030) — five lanes squeeze the region, they don't unpin the bar.
  await root.verifyTransportFullyInViewport()
  await root.verifyGridWellIsTheScroller()
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
