import { expect } from '@playwright/experimental-ct-react'

import { SAVE_KEY } from './persistence/storage.ts'
import { test } from './testing/iwftTest.tsx'

// Ticket 36: the starters left the main screen for a "New boop" dialog opened
// from the bottom bar, and a browser that has never been here opens on
// `Wonky Walk` rather than an empty grid.

test('the starters are behind the New boop button, not on the main screen', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await expect(root.presetCard('blank')).toHaveCount(0)

  await root.openNewBoop()
  await root.verifyStarterOrder(['Blank', 'Wonky Walk', 'Robot Hiccup', 'Sunday Stomp'])
})

test('picking a starter loads it, closes the dialog, and is ready to play', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.verifyCellOff('kick', 0)

  await root.loadPreset('wonky')
  await root.verifyCellOn('kick', 0)
  await root.verifyTempo(92)

  await root.pressPlay()
  await root.verifyPlaying()
  await root.fireStep() // tick 0 -> step 0, kick is on from the starter
  await root.verifyPlayed([{ instrumentId: 'kick', audioTime: 0.1 }])
})

test('the loaded ring is internal to the dialog, and drops on the first edit', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.loadPreset('robot')
  await root.openNewBoop()
  await root.verifyPresetLoaded('robot')
  await root.closeNewBoop()

  await root.toggleCell('boop', 0)
  await root.openNewBoop()
  await root.verifyPresetNotLoaded('robot')
})

// One definition of "changed" across the app (ticket 31): the ring used to
// survive a tempo move, and no longer does.
test('the loaded ring drops on a tempo change, and on clear-all', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.loadPreset('stomp')
  await root.setTempoPercent(80)
  await root.openNewBoop()
  await root.verifyPresetNotLoaded('stomp')
  await root.closeNewBoop()

  await root.loadPreset('stomp')
  await root.openClearGridConfirm()
  await root.clearIt()
  await root.openNewBoop()
  await root.verifyPresetNotLoaded('stomp')
})

test('blank clears the working grid through the same load path', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.loadPreset('stomp')
  await root.verifyCellOn('kick', 0)

  await root.loadPreset('blank')
  await root.verifyCellOff('kick', 0)
  await root.verifyCellOff('snare', 4)
})

test('closing the dialog without picking leaves the grid alone', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('marimba', 3)
  await root.openNewBoop()
  await root.closeNewBoop()

  await root.verifyNewBoopDialogClosed()
  await root.verifyCellOn('marimba', 3)
})

test('a fresh browser opens on Wonky Walk, and autosaves it', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  // Cleared *after* the reload: the outgoing page flushes its pending autosave
  // on the way out, so clearing first would only be undone.
  await page.reload()
  await first.root.clearSavedState()

  const { root } = await mountApp()
  await root.verifyIsShown()

  // Wonky Walk: kick early and late, marimba left silent as the obvious gap.
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOn('kick', 6)
  await root.verifyCellOff('marimba', 0)
  await root.verifyTempo(92)

  await root.waitForAutosavedCell('kick', 6)
})

test('a returning browser is never re-seeded, even from an empty grid', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  await first.root.startBlank()
  await first.root.toggleCell('tom', 2)
  await first.root.waitForAutosavedCell('tom', 2)

  await page.reload()
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyCellOn('tom', 2)
  await root.verifyCellOff('kick', 0) // not Wonky Walk again
})

test('the seed leaves the save format alone — same shape, same version', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  // Cleared *after* the reload: the outgoing page flushes its pending autosave
  // on the way out, so clearing first would only be undone.
  await page.reload()
  await first.root.clearSavedState()

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.waitForAutosavedCell('kick', 0)

  const raw = await page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY)
  const document_ = JSON.parse(raw!) as Record<string, unknown>
  expect(document_.version).toBe(1)
  expect(Object.keys(document_).sort()).toEqual(['creations', 'version', 'working'])
})

test('picking a starter never touches a saved boop, only the working grid', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  const savedBoop = {
    name: 'My boop',
    kitId: 'launch',
    tempo: 120,
    patterns: [{ rows: [{ instrumentId: 'kick', steps: '1000000000000000' }] }],
  }
  await page.evaluate(
    ({ key, doc }) => window.localStorage.setItem(key, JSON.stringify(doc)),
    { key: SAVE_KEY, doc: { version: 1, working: null, creations: [savedBoop] } },
  )
  await page.reload()

  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.loadPreset('robot')
  await root.waitForAutosavedCell('kick', 0) // robot's kick sits on step 0

  const saved = await root.readSavedBoops()
  expect(saved).toEqual([savedBoop])
})

test.describe('small phone', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test('New boop is a 44px button in the bar, and Fast clears it', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPhoneChromeShown()

    await root.verifyNewBoopButtonTapTarget()
    await root.verifyTempoClearsNewBoopButton()
    await root.verifyTransportHasNoOverflow()

    await root.loadPreset('stomp')
    await root.verifyCellOn('kick', 0)
  })
})

test.describe('390px phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Fast clears the New boop button here too', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyTempoClearsNewBoopButton()
    await root.verifyTransportHasNoOverflow()
  })
})
