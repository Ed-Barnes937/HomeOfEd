import { expect } from '@playwright/experimental-ct-react'

import { normalise } from './engine/schema.ts'
import { parseSaveDocument, type StoredWand } from './persistence/saveFormat.ts'
import { decodeShareHash, encodeShare, SHARE_HASH_PREFIX } from './share/shareLink.ts'
import { setFamilyCookie } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'
import {
  readAllLocalStorage,
  readLocalSave,
  seedLegacySave,
  shelfDocument,
} from './testing/localSaves.ts'
import { ShopPom } from './testing/ShopPom.ts'
import { wandSchema } from './wand/wandSchema.ts'

/**
 * `/shared#w=...` is open to anyone and keeps nothing (ADR 0093 decision 6):
 * shape the wand, and the only way to keep it is the root, behind the gate.
 */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const

const SHARED: StoredWand = {
  params: normalise(wandSchema, { wood: 'walnut', core: 'emberstone' }),
  name: 'From a friend',
}
const FRAGMENT = `${SHARE_HASH_PREFIX}${encodeShare(SHARED)}`

test('a /shared link opens the wand to change, and writes nothing to localStorage', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  const before = await readAllLocalStorage(page)

  await ShopPom.openAt(page, `/shared${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyWandName('From a friend')
  await root.verifyStage({ wood: 'walnut', core: 'emberstone' })
  await root.choose('Oak')
  await root.verifyStage({ wood: 'oak' })
  await root.rename('Mine now')
  // Past the autosave, then the pagehide flush a reload brings.
  await page.waitForTimeout(1_000)
  expect(await readAllLocalStorage(page)).toEqual(before)
  await page.reload()
  expect(await readAllLocalStorage(page)).toEqual(before)
})

test('a signed-in visitor’s own shelf and counter are untouched by /shared', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)
  const mine = await mountApp()
  await mine.root.rename('Acorn')
  await mine.root.keep()
  await page.reload()
  const before = await readAllLocalStorage(page)

  await ShopPom.openAt(page, `/shared${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyWandName('From a friend')
  await root.choose('Oak')
  await page.waitForTimeout(1_000)
  await page.reload()

  expect(await readAllLocalStorage(page)).toEqual(before)
})

test('a signed-in visitor with only a pre-profile shelf adopts nothing on /shared', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLegacySave(page, shelfDocument(['From before profiles']))
  await setFamilyCookie(page, ADA)
  const before = await readAllLocalStorage(page)

  await ShopPom.openAt(page, `/shared${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyWandName('From a friend')
  await page.waitForTimeout(1_000)
  await page.reload()

  expect(await readAllLocalStorage(page)).toEqual(before)
})

test('/shared offers only "Keep this wand": no shelf and no player', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  await ShopPom.openAt(page, `/shared${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyWandName('From a friend')
  await root.verifyNothingOffersToSave()
  await root.verifyNoPlayer()
})

test('/shared keeps its fragment, so a reload reopens the share as it was sent', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()

  await ShopPom.openAt(page, `/shared${FRAGMENT}`)
  const opened = await mountApp()
  await opened.root.verifyWandName('From a friend')
  await opened.root.choose('Oak')
  const address = new URL(page.url())
  expect(address.pathname).toBe('/shared')
  expect(decodeShareHash(address.hash)).toEqual(SHARED)

  // A reload, on this harness: a fresh document first loaded on the same address.
  await page.evaluate(() => window.history.replaceState(null, '', '/'))
  await page.reload()
  await ShopPom.openAt(page, `${address.pathname}${address.hash}`)
  const { root } = await mountApp()
  await root.verifyStage({ wood: 'walnut' })
})

test('"Keep this wand" with no edits carries the link’s fragment byte for byte', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()

  await ShopPom.openAt(page, `/shared${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyWandName('From a friend')
  const kept = await root.keepShared()

  expect(kept).toBe(`${new URL(kept).origin}/${FRAGMENT}`)
})

test('"Keep this wand" from a link with no wand in it goes to the root with no fragment', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()

  await ShopPom.openAt(page, '/shared#w=%7B%22not%22%3A%22a%20wand%22%7D')
  const { root } = await mountApp()
  await root.verifyIsShown()
  const kept = await root.keepShared()

  expect(kept).toBe(`${new URL(kept).origin}/`)
})

test('"Keep this wand" keeps the visitor’s changes', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()

  await ShopPom.openAt(page, `/shared${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyWandName('From a friend')
  await root.choose('Oak')
  await root.rename('Mine now')
  const kept = await root.keepShared()

  expect(new URL(kept).pathname).toBe('/')
  const wand = decodeShareHash(new URL(kept).hash)
  expect(wand?.name).toBe('Mine now')
  expect(wand?.params.wood).toBe('oak')
  expect(wand?.params.core).toBe('emberstone')
})

test('a root #w= link still opens the wand for a signed-in player, on their counter', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  await ShopPom.openAt(page, `/${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyWandName('From a friend')
  await expect.poll(() => new URL(page.url()).hash).toBe('')

  await page.reload()
  expect(parseSaveDocument(await readLocalSave(page, ADA.sub)).working).toEqual(SHARED)
})
