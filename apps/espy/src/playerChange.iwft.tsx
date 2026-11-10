import { expect } from '@playwright/experimental-ct-react'

import { readDoodle, setFamilyCookie, storedStrokes } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'

/** A page shows and saves one profile's doodle, the one it opened for (ADR 0094). */

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
  await root.drawStroke({ x: 30, y: 30 }, { x: 120, y: 120 })
  await expect.poll(() => storedStrokes(page, CY.sub)).toBe(1)

  // Bo is picked at hub in another tab; this tab is then looked at again.
  await setFamilyCookie(page, BO)
  const reloaded = page.waitForEvent('load')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await reloaded

  expect(await storedStrokes(page, CY.sub)).toBe(1)
  expect(await readDoodle(page, BO.sub)).toBeNull()
})

test('the same player looking again leaves the page as it is', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, CY)

  const { root } = await mountApp()
  await root.verifyIsShown()
  let loads = 0
  page.on('load', () => loads++)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))

  await root.verifyPlayerShown('Cy')
  expect(loads).toBe(0)
})
