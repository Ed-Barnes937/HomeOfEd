import { expect } from '@playwright/experimental-ct-react'

import { readLocalItem, savedNames, setFamilyCookie } from './testing/familySession.ts'
import { FridgePagePom } from './testing/FridgePagePom.ts'
import { test } from './testing/iwftTest.tsx'
import { seedSharedHello, SHARED_ID } from './testing/sharedBoardSeed.ts'

/** A page shows and saves the fridge of the player it opened for (ADR 0094). */

const CY = { sub: 'child-cy', role: 'child', parentId: 'parent-1', name: 'Cy' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

test('another tab switching player reloads this one when it is looked at again', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, CY)

  const { root } = await mountApp()
  await root.setNameInput('Cy’s')
  await root.clickSave()
  await root.verifyChip('Cy’s')

  // Bo is picked at hub in another tab; this tab is then looked at again.
  await setFamilyCookie(page, BO)
  const reloaded = page.waitForEvent('load')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await reloaded

  expect(savedNames(await readLocalItem(page, 'fridge:v1@child-cy'))).toEqual(['Cy’s'])
  expect(await readLocalItem(page, 'fridge:v1@child-bo')).toBeNull()
})

test('a shared fridge stays put when another player is picked, so a visitor keeps their edits', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, CY)
  await FridgePagePom.openAt(page, `/b/${SHARED_ID}`)

  const { root } = await mountApp({ seed: seedSharedHello })
  await root.verifyMagnetCount(2)
  await root.tapTile('A')
  let loads = 0
  page.on('load', () => loads++)
  await setFamilyCookie(page, BO)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await page.waitForTimeout(500)

  expect(loads).toBe(0)
  await root.verifyMagnetCount(3)
})
