import { expect } from '@playwright/experimental-ct-react'

import {
  presetNames,
  PRESETS_V1,
  PRESETS_V2,
  readPresets,
  seedDevicePresets,
  setFamilyCookie,
} from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'

/** Presets belong to whoever is playing (ADR 0094); garden settings stay with the device. */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

const v2Preset = { name: 'Kept on v2', ring: 120, wheels: [30], offset: 0.5, speed: 50 }
const v1Preset = { name: 'Kept on v1', ring: 96, wheels: [24], offset: 0.4, speed: 40, rake: 1, turns: 3 }

test('one player’s presets are not another’s on the same device', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  const ada = await mountApp()
  await ada.root.verifyIsShown()
  await ada.root.clickSave()
  await ada.root.verifyPresetVisible(0)

  await page.reload()
  await setFamilyCookie(page, BO)
  const bo = await mountApp()
  await bo.root.verifyIsShown()
  await bo.root.verifyMenuAbsent()

  expect(await presetNames(page, ADA.sub)).toHaveLength(1)
  expect(await presetNames(page, BO.sub)).toEqual([])
  expect(await presetNames(page, null)).toEqual([])
})

test('presets saved on a v2 device appear for a player, and the device copy is never written', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedDevicePresets(page, PRESETS_V2, [v2Preset])
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPresetName(0, 'Kept on v2')
  await root.clickSave()
  await root.verifyPresetVisible(1)

  expect(await presetNames(page, ADA.sub)).toHaveLength(2)
  expect(await readPresets(page, PRESETS_V2, null)).toBe(JSON.stringify([v2Preset]))
})

test('renaming a player’s preset changes only their copy', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedDevicePresets(page, PRESETS_V2, [v2Preset])
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.renamePreset(0, 'Ada’s garden')
  await root.verifyPresetName(0, 'Ada’s garden')

  await expect.poll(() => presetNames(page, ADA.sub)).toEqual(['Ada’s garden'])
  expect(await readPresets(page, PRESETS_V2, null)).toBe(JSON.stringify([v2Preset]))
})

test('deleting a player’s preset changes only their copy', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedDevicePresets(page, PRESETS_V2, [v2Preset])
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.deletePreset(0)
  await root.verifyPresetAbsent(0)

  await expect.poll(() => presetNames(page, ADA.sub)).toEqual([])
  expect(await readPresets(page, PRESETS_V2, ADA.sub)).toBe('[]')
  expect(await readPresets(page, PRESETS_V2, null)).toBe(JSON.stringify([v2Preset]))
})

test('presets from a v1 device migrate into the player’s own key, leaving the device as it was', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedDevicePresets(page, PRESETS_V1, [v1Preset])
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPresetName(0, 'Kept on v1')

  expect(await presetNames(page, ADA.sub)).toEqual(['Kept on v1'])
  expect(await readPresets(page, PRESETS_V1, null)).toBe(JSON.stringify([v1Preset]))
  expect(await readPresets(page, PRESETS_V2, null)).toBeNull()
})

test('another tab switching player reloads this one when it is looked at again', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.clickSave()
  await root.verifyPresetVisible(0)

  // Bo is picked at hub in another tab; this tab is then looked at again.
  await setFamilyCookie(page, BO)
  const reloaded = page.waitForEvent('load')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await reloaded

  expect(await presetNames(page, ADA.sub)).toHaveLength(1)
  expect(await readPresets(page, PRESETS_V2, BO.sub)).toBeNull()
})

test('the same player looking again leaves the page as it is', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await root.verifyIsShown()
  let loads = 0
  page.on('load', () => loads++)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))

  await root.verifyPlayer('Ada')
  expect(loads).toBe(0)
})

for (const width of [390, 800, 1280]) {
  test(`at ${width}px the player circle mirrors the back button, clear of the wordmark, and names the player on hover`, async ({
    mountApp,
    page,
  }) => {
    const first = await mountApp()
    await first.root.verifyIsShown()
    await page.setViewportSize({ width, height: 800 })
    await page.reload()
    await setFamilyCookie(page, { ...ADA, name: 'Abcdefghijklmnopqrstuv' })

    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPlayer('Abcdefghijklmnopqrstuv')
    await root.verifyPlayerMirrorsBack()
    await root.verifyPlayerClearOfWordmark()
    await root.verifyPlayerTitle('Abcdefghijklmnopqrstuv')
  })
}

test('the player is named only when someone is signed in', async ({ mountApp, page }) => {
  const signedOut = await mountApp()
  await signedOut.root.verifyIsShown()
  await signedOut.root.verifyNoPlayer()

  await page.reload()
  await setFamilyCookie(page, ADA)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPlayer('Ada')
})
