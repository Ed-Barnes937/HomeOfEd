import { expect } from '@playwright/experimental-ct-react'

import { seedFamily, setFamilyCookie } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'
import { readLocalSave, savedNames } from './testing/localSaves.ts'

/** A page shows and saves one profile's work, the one it opened for (ADR 0080 as amended). */

const CY = { sub: 'child-cy', role: 'child', parentId: 'parent-1', name: 'Cy' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

test('another tab switching player reloads this one when it is looked at again', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedFamily(page, { session: CY })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.openBoops()
  const name = await root.saveBoop()
  await root.closeBoops()

  // Bo is picked at hub in another tab; this tab is then looked at again.
  await setFamilyCookie(page, BO)
  const reloaded = page.waitForEvent('load')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await reloaded

  expect(savedNames(await readLocalSave(page, CY.sub))).toEqual([name])
  expect(await readLocalSave(page, BO.sub)).toBeNull()
})

test('the same player looking again leaves the page as it is', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedFamily(page, { session: CY })

  const { root } = await mountApp()
  await root.verifyIsShown()
  let loads = 0
  page.on('load', () => loads++)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))

  await root.verifySyncedChip('Cy')
  expect(loads).toBe(0)
})
