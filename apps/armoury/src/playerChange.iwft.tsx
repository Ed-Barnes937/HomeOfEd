import { expect } from '@playwright/experimental-ct-react'

import { normalise } from './engine/schema.ts'
import { encodeShare, SHARE_HASH_PREFIX } from './share/shareLink.ts'
import { setFamilyCookie } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'
import { readLocalSave, shelfNames } from './testing/localSaves.ts'
import { ShopPom } from './testing/ShopPom.ts'
import { wandSchema } from './wand/wandSchema.ts'

/** A page shows and saves one profile's wands, the one it opened for (ADR 0094). */

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
  await root.rename('Cy’s own')
  await root.keep()

  // Bo is picked at hub in another tab; this tab is then looked at again.
  await setFamilyCookie(page, BO)
  const reloaded = page.waitForEvent('load')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await reloaded

  expect(shelfNames(await readLocalSave(page, CY.sub))).toEqual(['Cy’s own'])
  expect(await readLocalSave(page, BO.sub)).toBeNull()
})

test('the same player looking again leaves the page as it is', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, CY)

  const { root } = await mountApp()
  await root.verifyPlayer('Cy')
  let loads = 0
  page.on('load', () => loads++)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await page.waitForTimeout(500)

  await root.verifyPlayer('Cy')
  expect(loads).toBe(0)
})

test('/shared stays put when another player is picked, so a visitor keeps their edits', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, CY)
  const shared = encodeShare({ params: normalise(wandSchema, { wood: 'walnut' }) })
  await ShopPom.openAt(page, `/shared${SHARE_HASH_PREFIX}${shared}`)

  const { root } = await mountApp()
  await root.verifyStage({ wood: 'walnut' })
  await root.choose('Oak')
  let loads = 0
  page.on('load', () => loads++)
  await setFamilyCookie(page, BO)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await page.waitForTimeout(500)

  expect(loads).toBe(0)
  await root.verifyStage({ wood: 'oak' })
})
