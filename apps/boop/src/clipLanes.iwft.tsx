import { expect } from '@playwright/experimental-ct-react'

import { MAX_CLIPS, TINT_COUNT } from './persistence/saveFormat.ts'
import { SAVE_KEY } from './persistence/storage.ts'
import { test } from './testing/iwftTest.tsx'

// The clip-lanes laptop layout (boop-loops ticket 15, the handoff's 2a frame),
// at the default 1280px CT viewport — the width the design is normative for.
// A fresh browser is seeded with a sample clip (tickets 36/17), so suites that
// care about their starting grid say so with `startBlank()` — the top bar's
// New boop reset.

test('the old transport bar is gone; its pieces have their new homes', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyNoTransportBar()
  // Play became the clip control (in the well), tempo became Speed in the
  // song bar, New boop went to the top bar, Clear grid into the clip control.
  await root.verifyPaused()
  await root.verifyTempo(100) // the seed's speed, read from the song bar's Speed
  await root.openClipEditor()
  await root.verifyCellOn('kick', 0) // the sample-clip seed is on the grid
  await root.pressNewBoop()
  await root.openClipEditor()
  await root.verifyCellOff('kick', 0)
})

// What the reset lands on. There is no starter dialog to choose from any more
// (boop-loops ticket 07) - the only thing New boop can raise is the keep-card,
// which `pressNewBoop` answers with "Start fresh" and `newBoopSafety.iwft.tsx`
// owns (boop-clips ticket 03).
test('New boop resets to one blank clip, with no starters to choose from', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 2)
  await root.pressNewBoop()

  await root.verifyNoDialogOpen()
  await root.verifyClipCount(1)
  await root.verifySongLength('0 bars')
  await root.openClipEditor()
  await root.verifyCellOff('kick', 2)
  await root.verifyActiveClipName('Clip 1')
})

test('+ New clip adds a blank clip onto the grid, unplaced, and disables at the cap', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('kick', 0)

  await root.addClip()
  await root.verifyClipCount(2)
  await root.verifyClipChipActive(1)
  await root.verifySongLength('0 bars')
  await root.openClipEditor()
  await root.verifyActiveClipName('Clip 2')
  // The new clip is blank - the kick lives in Clip 1 - and nothing was placed.
  await root.verifyCellOff('kick', 0)

  for (let clip = 3; clip <= MAX_CLIPS; clip += 1) await root.addClip()
  await root.verifyClipCount(MAX_CLIPS)
  await root.verifyAddClipDisabled()
  // A copy is a new clip too, so the cap greys it the same way.
  await root.openClipEditor()
  await root.verifyCopyClipDisabled()
})

test('a clip per tint: ten clips wear ten different colours, and the lane grid scrolls to reach them', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.fillClipsTo(TINT_COUNT)

  // One tint per clip, read off the page rather than trusted to the constant
  // (boop-clips ticket 04): what matters is that a child sees ten colours.
  const tints = await root.readChipTints()
  expect(new Set(tints).size).toBe(TINT_COUNT)

  // And the lane grid takes the extra lanes in its own scroller.
  await root.verifyEveryClipIsReachable(TINT_COUNT)
  await root.verifyLastSongPositionIsReachable(TINT_COUNT - 1)
  await root.verifyFocusRingsFitTheScrollBox('song-lanes')
  await root.verifyNoHorizontalOverflow()
})

// Ticket 05: past ten clips the palette repeats rather than the clip being
// refused, so a colour stops naming one clip. What has to carry identity
// instead is the name - on the chip in the shelf, on the launcher in the dock,
// and in the lane square's own label. (Thumbnails wear no tint at all: the ones
// in "My boops" and the "+ New clip" picker are drawn in ink, so a repeated
// tint cannot reach them.)
test('past ten clips the tints repeat, and the names tell the sharing clips apart', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.fillClipsTo(TINT_COUNT + 1)

  // Eleven clips, ten colours: the eleventh takes the least-used tint, which on
  // a full palette is the first one again.
  const tints = await root.readChipTints()
  expect(new Set(tints).size).toBe(TINT_COUNT)
  expect(tints[TINT_COUNT]).toBe(tints[0])

  // The shelf is still readable: every chip has a name of its own, and the two
  // that share a colour are the two the names have to separate.
  const names = await root.readChipNames()
  expect(new Set(names).size).toBe(TINT_COUNT + 1)
  expect(names[0]).toBe('Clip 1')
  expect(names[TINT_COUNT]).toBe(`Clip ${TINT_COUNT + 1}`)

  // The dock names the clip it would open, and each lane square names its own.
  await root.verifyLauncherClip(`Clip ${TINT_COUNT + 1}`)
  await root.verifyLaneSquareNamesItsClip(0, 0, 'Clip 1')
  await root.verifyLaneSquareNamesItsClip(TINT_COUNT, 0, `Clip ${TINT_COUNT + 1}`)
})

test('a thirty-five clip song plays, is written with the letter z, and refuses the thirty-sixth', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await first.root.fillClipsTo(MAX_CLIPS)

  // The cap, at both routes to a new clip.
  await first.root.verifyAddClipDisabled()
  await first.root.openClipEditor()
  await first.root.verifyCopyClipDisabled()
  await first.root.closeClipEditor()

  await first.root.toggleLaneSquare(MAX_CLIPS - 1, 0)
  await first.root.toggleLaneSquare(0, 1)
  await first.root.verifySongLength('8 bars')
  await first.root.pressSongPlay()
  await first.root.verifySongPlaying()
  await first.root.crankSteps(1)
  await first.root.verifyPositionPlaying(MAX_CLIPS - 1, 0)

  // `z` is the last character the placement alphabet has, and the cap is there
  // because of it - so this is the byte the ceiling is made of.
  await first.root.waitForAutosavedPlacements('z1..............')

  await page.reload()
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyClipCount(MAX_CLIPS)
  await root.verifyPlacementOn(MAX_CLIPS - 1, 0)
  await root.verifyPlacementOn(0, 1)
  await root.verifySongLength('8 bars')
  await root.verifyAddClipDisabled()
  await root.verifyEveryClipIsReachable(MAX_CLIPS)
  await root.verifyLastSongPositionIsReachable(MAX_CLIPS - 1)
  await root.verifyNoHorizontalOverflow()

  // Three and a half laps of the palette at this width too: every one of the
  // 35 chips carries a name of its own, and the dock names the clip it would
  // open - which is what a child reads a shared colour by.
  const names = await root.readChipNames()
  expect(new Set(names).size).toBe(MAX_CLIPS)
  await root.verifyLauncherClip(`Clip ${MAX_CLIPS}`)

  // Saved into "My boops" as well as autosaved: the same writer, so the row
  // carries all 35 clips and the same bytes the working slot has.
  await root.openBoops()
  await root.saveBoop()
  const saved = await root.readSavedBoops()
  expect(saved[0]?.patterns).toHaveLength(MAX_CLIPS)
  expect(saved[0]?.placements).toBe('z1..............')
})

test('a ten-clip song is written with the letter a, plays, and survives a reload', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  // Ten exactly, whatever the cap: the tenth clip is the first one the digits
  // cannot name, so it is what the letter is for.
  await first.root.fillClipsTo(10)

  await first.root.toggleLaneSquare(9, 0)
  await first.root.toggleLaneSquare(0, 1)
  await first.root.verifySongLength('8 bars')
  await first.root.pressSongPlay()
  await first.root.verifySongPlaying()
  await first.root.crankSteps(1)
  await first.root.verifyPositionPlaying(9, 0)

  await first.root.waitForAutosavedPlacements('a1..............')

  await page.reload()
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyClipCount(10)
  await root.verifyPlacementOn(9, 0)
  await root.verifyPlacementOn(0, 1)
  await root.verifySongLength('8 bars')
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

/**
 * Clear grid empties the beats and keeps the rows. Since ADR 0042 a clip's
 * rows are the child's own choice of instruments, and clearing the beats is no
 * reason to take that away — it must not fall back to the default six.
 * Seeded, because nothing picks rows through the UI until the picker lands.
 */
test('Clear grid keeps the clip’s own rows, and only empties them', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  const rows = [
    { instrumentId: 'cowbell', steps: '1000000000000000' },
    { instrumentId: 'kick', steps: '0000000010000000' },
    { instrumentId: 'chime', steps: '0000000000000000' },
  ]
  // Seeded after the reload: the outgoing page flushes its autosave on the way out.
  await page.reload()
  await page.evaluate(({ key, doc }) => window.localStorage.setItem(key, JSON.stringify(doc)), {
    key: SAVE_KEY,
    doc: {
      version: 1,
      working: { name: '', kitId: 'launch', tempo: 100, patterns: [{ rows }] },
      creations: [],
    },
  })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()
  await root.verifyGridRows(['cowbell', 'kick', 'chime'])
  await root.verifyCellOn('cowbell', 0)

  await root.openClearGridConfirm()
  await root.clearIt()

  await root.verifyGridRows(['cowbell', 'kick', 'chime'])
  await root.verifyCellOff('cowbell', 0)
  await root.verifyCellOff('kick', 8)
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
