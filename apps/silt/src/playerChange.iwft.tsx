import { expect } from '@playwright/experimental-ct-react'

import { SAND } from './sim/index.ts'
import { readSiltKeys, sceneNames, setFamilyCookie } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'

/** A page shows and saves one profile's work, the one it opened for (ADR 0094). */

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
  await root.verifyIsShown()
  await root.paintCell(40, 40)
  await root.openScenes()
  await root.saveScene()
  await root.verifySceneRow('scene 1')

  // Bo is picked at hub in another tab; this tab is then looked at again.
  await setFamilyCookie(page, BO)
  const reloaded = page.waitForEvent('load')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await reloaded

  expect(await sceneNames(page, CY.sub)).toEqual(['scene 1'])
  const stored = await readSiltKeys(page)
  expect(Object.keys(stored).filter((key) => key.endsWith(`@${BO.sub}`))).toEqual([])
})

test('the same player looking again leaves the page as it is', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, CY)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.paintCell(40, 40)
  let loads = 0
  page.on('load', () => loads++)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await page.waitForTimeout(500)

  expect(loads).toBe(0)
  expect(await root.countSpecies(SAND)).toBeGreaterThan(0)
})
