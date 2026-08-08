import { expect } from '@playwright/experimental-ct-react'

import { SAVE_KEY } from './persistence/storage.ts'
import { test } from './testing/iwftTest.tsx'

test('the app opens on an empty grid with the preset row visible, blank first', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyCellOff('kick', 0)
  await expect(root.presetCard('blank')).toBeVisible()
})

test('tapping a preset loads it into the grid, ready to play', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyCellOff('kick', 0)

  await root.loadPreset('wonky')
  await root.verifyPresetLoaded('wonky')
  await root.verifyCellOn('kick', 0)
  await root.verifyTempo(92)

  await root.pressPlay()
  await root.verifyPlaying()
  await root.fireStep() // tick 0 -> step 0, kick is on from the preset
  await root.verifyPlayed([{ instrumentId: 'kick', audioTime: 0.1 }])
})

test('tapping blank clears the working grid through the same load path', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.loadPreset('stomp')
  await root.verifyPresetLoaded('stomp')
  await root.verifyCellOn('kick', 0)

  await root.loadPreset('blank')
  await root.verifyPresetLoaded('blank')
  await root.verifyCellOff('kick', 0)
  await root.verifyCellOff('snare', 4)
})

test('the loaded ring drops on the first edit', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.loadPreset('robot')
  await root.verifyPresetLoaded('robot')

  await root.toggleCell('boop', 0)
  await root.verifyPresetNotLoaded('robot')
})

test('the loaded ring survives a tempo change, but drops on clear-all', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.loadPreset('stomp')
  await root.verifyPresetLoaded('stomp')

  await root.setTempoPercent(80)
  await root.verifyPresetLoaded('stomp')

  await root.openClearGridConfirm()
  await root.clearIt()
  await root.verifyPresetNotLoaded('stomp')
})

test('loading a preset never touches a saved boop, only the working grid', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  const savedCreation = {
    name: 'My boop',
    kitId: 'launch',
    tempo: 120,
    patterns: [{ rows: [{ instrumentId: 'kick', steps: '1000000000000000' }] }],
  }
  await page.evaluate(
    ({ key, doc }) => window.localStorage.setItem(key, JSON.stringify(doc)),
    { key: SAVE_KEY, doc: { version: 1, working: null, creations: [savedCreation] } },
  )
  await page.reload()

  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.loadPreset('robot')
  await root.verifyPresetLoaded('robot')
  await root.waitForAutosavedCell('kick', 0) // robot's kick sits on step 0

  const saved = await root.readSavedBoops()
  expect(saved).toEqual([savedCreation])
})
