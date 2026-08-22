import { test } from './testing/iwftTest.tsx'

// The clip-lanes laptop layout (boop-loops ticket 15, the handoff's 2a frame),
// at the default 1280px CT viewport — the width the design is normative for.
// A fresh browser is seeded with a sample clip (tickets 36/17), so suites that
// care about their starting grid say so with `startBlank()` — the top bar's
// plain New boop reset.

test('the old transport bar is gone; its pieces have their new homes', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyNoTransportBar()
  // Play became the clip control (in the well), tempo became Speed in the
  // song bar, New boop went to the top bar, Clear grid into the clip control.
  await root.verifyPaused()
  await root.verifyTempo(100) // the seed's speed, read from the song bar's Speed
  await root.verifyCellOn('kick', 0) // the sample-clip seed is on the grid
  await root.pressNewBoop()
  await root.verifyCellOff('kick', 0)
})

test('New boop is a plain reset: one blank clip, no dialog, no confirm', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 2)
  await root.pressNewBoop()

  await root.verifyNoDialogOpen()
  await root.verifyCellOff('kick', 2)
  await root.verifyClipCount(1)
  await root.verifyActiveClipName('Clip 1')
  await root.verifySongLength('0 bars')
})

test('+ New clip adds a blank clip onto the grid, unplaced, and disables at five', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('kick', 0)

  await root.addClip()
  await root.verifyClipCount(2)
  await root.verifyClipChipActive(1)
  await root.verifyActiveClipName('Clip 2')
  // The new clip is blank — the kick lives in Clip 1 — and nothing was placed.
  await root.verifyCellOff('kick', 0)
  await root.verifySongLength('0 bars')

  await root.addClip()
  await root.addClip()
  await root.addClip()
  await root.verifyClipCount(5)
  await root.verifyAddClipDisabled()
  // A copy is a new clip too, so the cap greys it the same way.
  await root.verifyCopyClipDisabled()
})

test('chips switch the grid between clips, and every edit writes into the one on screen', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.addClip()
  await root.toggleCell('snare', 4)

  await root.selectClip(0)
  await root.verifyClipChipActive(0)
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOff('snare', 4)

  await root.selectClip(1)
  await root.verifyCellOn('snare', 4)
  await root.verifyCellOff('kick', 0)
})

test('Make a copy duplicates the clip; Delete clip removes it and disables at one', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('tom', 7)

  await root.copyClip()
  await root.verifyClipCount(2)
  await root.verifyClipChipActive(1)
  await root.verifyCellOn('tom', 7) // the copy carries the pattern

  await root.deleteClip()
  await root.verifyClipCount(1)
  await root.verifyClipChipActive(0)
  await root.verifyCellOn('tom', 7) // back on the original
  await root.verifyDeleteClipDisabled()
})

test('renaming a clip is inline, and shows on its chip', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.renameActiveClip('Thunder')
  await root.verifyActiveClipName('Thunder')
  await root.verifyClipChipName(0, 'Thunder')
})

test('placements toggle by pointer: place, layer a second clip on top, tap each off', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.addClip()

  await root.toggleLaneSquare(0, 0)
  await root.verifyPlacementOn(0, 0)
  await root.verifySongLength('4 bars')

  // Every lane is its own toggle: clip 2 layers onto the column, and clip 1
  // stays where it was. A layered column is still one position — 4 bars.
  await root.toggleLaneSquare(1, 0)
  await root.verifyPlacementOn(1, 0)
  await root.verifyPlacementOn(0, 0)
  await root.verifySongLength('4 bars')

  // Tapping one layer off leaves the other sounding.
  await root.toggleLaneSquare(1, 0)
  await root.verifyPlacementOff(1, 0)
  await root.verifyPlacementOn(0, 0)
  await root.verifySongLength('4 bars')

  await root.toggleLaneSquare(0, 0)
  await root.verifyPlacementOff(0, 0)
  await root.verifySongLength('0 bars')
})

test('no lane square marks a next free position, whichever clip is active', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.addClip()
  await root.toggleLaneSquare(1, 0)

  await root.verifyNoPlacementHint()
  await root.selectClip(0)
  await root.verifyNoPlacementHint()
})

test('the lane grid leaves room for its focus rings, and still lines up column-for-column', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.addClip()

  // Chips, placement squares and "+ New clip" all sit in the one scroll box.
  await root.verifyFocusRingsFitTheScrollBox('song-lanes')
  await root.verifyRulerAlignedOverSquare(0)
  await root.verifyRulerAlignedOverSquare(15)
})

test('lane squares follow the grid keyboard model: arrows move, Enter places, Backspace removes', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.laneSquare(0, 0).focus()
  await page.keyboard.press('ArrowRight')
  await root.laneSquare(0, 1).press('Enter')
  await root.verifyPlacementOn(0, 1)
  await root.laneSquare(0, 1).press('Backspace')
  await root.verifyPlacementOff(0, 1)
})

test('dragging a chip reorders lanes; placements and tints travel; a small press still selects', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.addClip() // Clip 2, tint 1, now active
  await root.toggleLaneSquare(0, 0)
  await root.toggleLaneSquare(1, 1)

  // Mid-drag: the dragged chip lifts and the other lane makes way live.
  await root.beginChipDrag(0, 1)
  await root.verifyChipLifted(0)
  await root.verifyLaneMakingWay(1, 'up')
  await root.releaseChip()

  await root.verifyClipChipName(0, 'Clip 2')
  await root.verifyClipChipName(1, 'Clip 1')
  // Placements were rewritten in the same update: each clip kept its squares.
  await root.verifyPlacementOn(1, 0) // Clip 1, now lane 1, still at position 1
  await root.verifyPlacementOn(0, 1) // Clip 2, now lane 0, still at position 2
  // Tints travelled with their clips — the reorder recoloured nothing.
  await root.verifyChipTint(0, 1)
  await root.verifyChipTint(1, 0)

  // A sub-threshold press is a tap: it selects the clip, moving nothing.
  await root.pressChipBelowThreshold(1)
  await root.verifyClipChipActive(1)
  await root.verifyClipChipName(1, 'Clip 1')
})

test("Ctrl/Cmd+ArrowDown moves the focused chip's lane; a plain arrow moves nothing", async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.addClip()

  // Plain arrows keep their navigation meaning — no reorder.
  await root.clipChip(0).press('ArrowDown')
  await root.verifyClipChipName(0, 'Clip 1')

  await root.reorderChipByKeyboard(0, 'down')
  await root.verifyClipChipName(0, 'Clip 2')
  await root.verifyClipChipName(1, 'Clip 1')
  // Focus follows the moved chip, so the next press keeps moving the same lane.
  await root.verifyChipFocused(1)

  await root.reorderChipByKeyboard(1, 'up')
  await root.verifyClipChipName(0, 'Clip 1')
  await root.verifyChipFocused(0)

  // Cmd works too — the spec says Ctrl/Cmd, whichever the child's machine has.
  await root.clipChip(0).press('Meta+ArrowDown')
  await root.verifyClipChipName(0, 'Clip 2')
  await root.verifyChipFocused(1)
})

test('a lane reorder marks the loaded boop edited', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.addClip()

  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await root.verifySavedState('Boop 1')

  await root.reorderChipByKeyboard(0, 'down')
  await root.verifySavedState('Boop 1 • edited')
})

test('Clear grid clears only the clip on screen, and marks the loaded boop edited', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.addClip()
  await root.toggleCell('snare', 4)

  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await root.verifySavedState('Boop 1')

  await root.openClearGridConfirm()
  await root.clearIt()
  await root.verifyCellOff('snare', 4)
  await root.verifySavedState('Boop 1 • edited')

  // Clip 1 kept its kick — the clear was clip-scoped.
  await root.selectClip(0)
  await root.verifyCellOn('kick', 0)
})

test('clip add, rename and placement each mark the loaded boop edited', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await root.verifySavedState('Boop 1')

  await root.toggleLaneSquare(0, 0)
  await root.verifySavedState('Boop 1 • edited')

  await root.openBoops()
  await root.loadBoop(0) // loading closes the panel itself
  await root.verifySavedState('Boop 1')
  await root.renameActiveClip('Thunder')
  await root.verifySavedState('Boop 1 • edited')

  await root.openBoops()
  await root.loadBoop(0)
  await root.verifySavedState('Boop 1')
  await root.addClip()
  await root.verifySavedState('Boop 1 • edited')
})

test('song play is the song grid’s header, the same as on the phone', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifySongPlayIsTheSongHeader()
  await root.pressSongPlay()
  await root.verifySongPlaying()
})
