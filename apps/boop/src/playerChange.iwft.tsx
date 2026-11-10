import { expect } from '@playwright/experimental-ct-react'

import { encodeShare, SHARE_HASH_PREFIX } from './share/shareLink.ts'
import { seedFamily, setFamilyCookie } from './testing/familySession.ts'
import { HomePagePom } from './testing/HomePagePom.ts'
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

test('/shared stays put when another player is picked, so a visitor keeps their edits', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedFamily(page, { session: CY })
  const shared = encodeShare({
    name: 'From a friend',
    kitId: 'launch',
    tempo: 110,
    patterns: [{ rows: [{ instrumentId: 'kick', steps: '1000000000000000' }] }],
  })
  await HomePagePom.openAt(page, `/shared${SHARE_HASH_PREFIX}${shared}`)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()
  await root.toggleCell('kick', 8)
  let loads = 0
  page.on('load', () => loads++)
  await setFamilyCookie(page, BO)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await page.waitForTimeout(500)

  expect(loads).toBe(0)
  await root.verifyCellOn('kick', 8)
})
