import { expect } from '@playwright/experimental-ct-react'

import {
  readLocalItem,
  savedNames,
  setFamilyCookie,
  writeLocalItem,
} from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'

/** The fridge on a device belongs to whoever is playing (ADR 0094, estate-gate spec decisions 7 and 8). */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

const LEGACY = JSON.stringify({
  v: 1,
  current: {
    name: 'From before profiles',
    finish: 'white',
    wall: 'warm',
    magnets: [{ type: 'letter', label: 'Z', deg: 0, color: 'red', x: 300, y: 60, rot: 0 }],
  },
  saved: [
    {
      name: 'From before profiles',
      finish: 'white',
      wall: 'warm',
      magnets: [{ type: 'letter', label: 'Z', deg: 0, color: 'red', x: 300, y: 60, rot: 0 }],
    },
  ],
})

test('one player’s fridge is not another’s on the same device', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  const ada = await mountApp()
  await ada.root.verifyIsShown()
  await ada.root.tapTile('A')
  await ada.root.setNameInput('Ada’s words')
  await ada.root.clickSave()
  await ada.root.verifyChip('Ada’s words')

  await page.reload()
  await setFamilyCookie(page, BO)
  const bo = await mountApp()
  await bo.root.verifyIsShown()
  await bo.root.verifyDemoBoard()
  await bo.root.verifyNoChip('Ada’s words')

  expect(savedNames(await readLocalItem(page, 'fridge:v1@child-ada'))).toEqual(['Ada’s words'])
  expect(savedNames(await readLocalItem(page, 'fridge:v1@child-bo'))).toEqual([])
})

test('a fridge kept before profiles appears for every player, and stays on the device', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await writeLocalItem(page, 'fridge:v1', LEGACY)
  await setFamilyCookie(page, ADA)

  const ada = await mountApp()
  await ada.root.verifyNameInputValue('From before profiles')
  await ada.root.verifyActiveChip('From before profiles')
  await ada.root.tapTile('A')
  await ada.root.verifyPersistedMagnetCount(2, 'fridge:v1@child-ada')

  await page.reload()
  await setFamilyCookie(page, BO)
  const bo = await mountApp()
  await bo.root.verifyNameInputValue('From before profiles')
  await bo.root.verifyMagnetCount(1)

  expect(await readLocalItem(page, 'fridge:v1')).toBe(LEGACY)
})

test('the player is named, as the way to switch player', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyNoPlayerChip()
  await page.reload()
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await root.verifyPlayerChip('Ada')
  await root.verifyPlayerChipEndsBar()
})

test('on a phone the player circle ends the icon strip', async ({ mountApp, page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  const { root } = await mountApp()
  await root.verifyMobileBarShown()
  await root.verifyPlayerChip('Ada')
  await root.verifyPlayerChipEndsBar()
  await root.verifyNoHorizontalOverflow()
})
