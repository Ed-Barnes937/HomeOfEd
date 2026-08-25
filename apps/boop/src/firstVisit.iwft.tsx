import { expect } from '@playwright/experimental-ct-react'

import { SAVE_KEY } from './persistence/storage.ts'
import { test } from './testing/iwftTest.tsx'

// The first-visit seed (tickets 36/17) and the plain New boop reset (spec §7).
// Since ticket 17 retired the starters, a browser that has never been here is
// seeded with a one-clip song whose clip is a sample clip (Boom clap) — it
// still sounds like something and demos the model — and "New boop" is a
// plain, no-dialog reset at every width.

test('a fresh browser opens on a sample clip, and autosaves it', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  // Cleared *after* the reload: the outgoing page flushes its pending autosave
  // on the way out, so clearing first would only be undone.
  await page.reload()
  await first.root.clearSavedState()

  const { root } = await mountApp()
  await root.verifyIsShown()

  // Boom clap: kick heartbeat under a backbeat snare, at the default speed.
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOn('kick', 8)
  await root.verifyCellOn('snare', 4)
  await root.verifyCellOn('snare', 12)
  await root.verifyCellOff('hat', 0)
  await root.verifyTempo(100)
  // A one-clip song named after the sample, with an empty song bar.
  await root.verifyClipCount(1)
  await root.verifyActiveClipName('Boom clap')
  await root.verifySongLength('0 bars')

  await root.waitForAutosavedCell('kick', 8)
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
  await root.verifyCellOff('kick', 0) // not the seed again
})

test('the seed leaves the save format alone — same shape, same version', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  // Cleared *after* the reload, as above.
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

test.describe('tablet', () => {
  test.use({ viewport: { width: 1100, height: 800 } })

  test('New boop is a plain reset below 1280 too: no dialog, straight to blank', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.toggleCell('marimba', 3)
    await root.pressNewBoop()

    await root.verifyNoDialogOpen()
    await root.verifyCellOff('marimba', 3)
    await root.verifyCellOff('kick', 0)
    await root.verifyTempo(100)
  })

  test('New boop only resets the working slot, never a saved boop', async ({
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

    await root.pressNewBoop()
    await root.verifyCellOff('kick', 0)

    const saved = await root.readSavedBoops()
    expect(saved).toEqual([savedBoop])
  })
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

    await root.toggleCell('boop', 5)
    await root.pressNewBoop()
    await root.verifyCellOff('boop', 5)
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
