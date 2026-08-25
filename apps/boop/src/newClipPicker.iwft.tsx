import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

// The "+ New clip" picker (boop-loops ticket 17, spec §6): tapping "+ New
// clip" opens a dialog — Blank first, then the eight sample clips — instead
// of creating a blank directly. Runs at the default 1280px CT viewport, where
// the song bar (and so "+ New clip") lives.

test('"+ New clip" opens the picker: Blank first, then the eight sample clips', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openNewClipPicker()
  await root.verifyPickerCardOrder([
    'Blank',
    'Slow bass',
    'Bouncy bass',
    'Tap tap hat',
    'Sneaky hat',
    'Boom clap',
    'Tumble toms',
    'Twinkle tune',
    'Boop boop',
  ])
})

test('picking a sample clip lands it named, on the grid, unplaced — and playing', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openNewClipPicker()
  await root.pickClip('boom-clap')

  await root.verifyClipCount(2)
  await root.verifyClipChipActive(1)
  await root.verifyActiveClipName('Boom clap')
  // The sample's pattern is on the grid…
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOn('snare', 4)
  // …nothing was placed in the song, and the boop's speed is untouched —
  // sample clips are pattern-only, playing at the boop's one bpm.
  await root.verifySongLength('0 bars')
  await root.verifyTempo(100)
  // No per-card preview: picking is how you hear one.
  await root.verifyPlaying()
})

test('picking Blank lands the automatic "Clip N", silent', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openNewClipPicker()
  await root.pickClip('blank')

  await root.verifyClipCount(2)
  await root.verifyActiveClipName('Clip 2')
  await root.verifyPaused()
})

test('closing without picking adds nothing: the × and the backdrop both dismiss', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openNewClipPicker()
  await root.closeNewClipPicker()
  await root.verifyPickerClosed()
  await root.verifyClipCount(1)

  await root.openNewClipPicker()
  await root.dismissPickerByOutsideTap()
  await root.verifyPickerClosed()
  await root.verifyClipCount(1)
})

test("a sample clip's name is renameable like any other clip's", async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openNewClipPicker()
  await root.pickClip('twinkle-tune')
  await root.verifyActiveClipName('Twinkle tune')

  await root.renameActiveClip('Sparkles')
  await root.verifyActiveClipName('Sparkles')
  await root.verifyClipChipName(1, 'Sparkles')
})

test('adding a sample clip is an edit like any other clip add', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await root.verifySavedState('Boop 1')

  await root.openNewClipPicker()
  await root.pickClip('slow-bass')
  await root.verifySavedState('Boop 1 • edited')
})

test('the picked clip reaches the autosave — a sample clip has no identity of its own', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openNewClipPicker()
  await root.pickClip('sneaky-hat')

  // The sample landed as plain clip data in the working song's second clip.
  await root.waitForAutosavedCell('hat', 2, 1)
  const working = await root.readAutosavedGrid()
  expect(working?.patterns).toHaveLength(2)
  expect(working?.patterns[1]?.name).toBe('Sneaky hat')
})
