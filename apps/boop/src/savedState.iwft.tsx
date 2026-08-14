import { test } from './testing/iwftTest.tsx'

/**
 * The saved/edited indicator (ticket 31). It answers one question — "is this
 * boop in My boops?" — and never "are you about to lose this", because the
 * working grid is autosaved regardless (ADR 0025).
 */

test('a grid that is not in "My boops" reads "Not saved yet"', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // The first-visit seed is a starter, and a starter is never in the list.
  await root.verifySavedState('Not saved yet')

  await root.toggleCell('kick', 2)
  await root.verifySavedState('Not saved yet')
})

test('saving names the grid, an edit marks it, and loading it back clears the mark', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await root.verifySavedState('Boop 1')

  await root.toggleCell('snare', 4)
  await root.verifySavedState('Boop 1 • edited')

  // A tempo move on top of an existing edit must not read as "put back".
  await root.setTempoPercent(70)
  await root.verifySavedState('Boop 1 • edited')

  await root.openBoops()
  await root.loadBoop(0)
  await root.verifySavedState('Boop 1')
})

test('a tempo change alone counts as an edit — tempo is part of a saved boop', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await root.verifySavedState('Boop 1')

  // Nothing on the grid moves; only the slider does.
  await root.setTempoPercent(80)
  await root.verifySavedState('Boop 1 • edited')
})

test('New boop drops the identity; Clear grid is an edit that keeps it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await root.verifySavedState('Boop 1')

  // Clear grid is clip-scoped and counts as an edit (boop-loops ticket 15,
  // spec §7) — the grid is still recognisably that boop, with things rubbed out.
  await root.openClearGridConfirm()
  await root.clearIt()
  await root.verifySavedState('Boop 1 • edited')

  await root.openBoops()
  await root.loadBoop(0)
  await root.verifySavedState('Boop 1')

  // New boop is the reset: a fresh one-clip song with no identity to carry.
  await root.pressNewBoop()
  await root.verifySavedState('Not saved yet')
})

test('the loaded boop wears a standing ring in "My boops"', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.saveBoop()
  await root.saveBoop()
  await root.verifyBoopCount(2)

  // A fresh save adopts the identity, so the second row is the loaded one.
  await root.verifyBoopRowNotLoaded(0)
  await root.verifyBoopRowLoaded(1)

  await root.loadBoop(0)
  await root.openBoops()
  await root.verifyBoopRowLoaded(0)
  await root.verifyBoopRowNotLoaded(1)
})

test('renaming the loaded boop renames the indicator; deleting it ends the identity', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.saveBoop()
  await root.renameBoop(0, 'Thunder')
  await root.closeBoops()
  await root.verifySavedState('Thunder')

  await root.openBoops()
  await root.openDeleteBoopConfirm(0)
  await root.clearIt()
  await root.closeBoops()
  await root.verifySavedState('Not saved yet')
})

test('deleting a row above the loaded one keeps the ring on the right boop', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.saveBoop() // Boop 1
  await root.saveBoop() // Boop 2 — the loaded one
  await root.verifyBoopRowLoaded(1)

  await root.openDeleteBoopConfirm(0)
  await root.clearIt()

  await root.verifyBoopCount(1)
  await root.verifyBoopName(0, 'Boop 2')
  await root.verifyBoopRowLoaded(0)
  await root.closeBoops()
  await root.verifySavedState('Boop 2')
})

test('an unsaved grid raises no browser confirm on the way out', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.verifySavedState('Not saved yet')

  // There is nothing losable to warn about — the working grid is flushed on
  // `pagehide` — and the browser's own wording is unreadable to a 6-year-old.
  await root.verifyNoUnloadPrompt()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the save icon carries a dot instead of the words', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPhoneChromeShown()

    await root.verifyPhoneSavedDot(true)

    await root.pressPhoneSave()
    await root.saveBoop()
    await root.closeBoops()
    await root.verifyPhoneSavedDot(false)

    await root.toggleCell('kick', 1)
    await root.verifyPhoneSavedDot(true)
  })
})
