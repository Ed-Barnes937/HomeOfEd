import { expect } from '@playwright/experimental-ct-react'

import {
  readAllLocalStorage,
  readAllSessionStorage,
  readLocalItem,
  savedNames,
  setFamilyCookie,
} from './testing/familySession.ts'
import { FridgePagePom } from './testing/FridgePagePom.ts'
import { test } from './testing/iwftTest.tsx'
import { seedSharedHello, SHARED_ID } from './testing/sharedBoardSeed.ts'

/**
 * `/b/<id>` is open to anyone and keeps nothing (ADR 0093 decision 6); keeping a
 * shared fridge is `/keep/<id>`, behind the gate.
 */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const

test('a shared link opens the fridge to play with, and writes nothing to local or session storage', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  const before = await readAllLocalStorage(page)
  const sessionBefore = await readAllSessionStorage(page)

  await FridgePagePom.openAt(page, `/b/${SHARED_ID}`)
  const { root } = await mountApp({ seed: seedSharedHello })
  await root.verifyMagnetCount(2)
  await root.verifyNameInputValue('Shared Hello')
  await root.verifySharedChrome(`/keep/${SHARED_ID}`)
  await root.tapTile('A')
  await root.verifyMagnetCount(3)
  await root.selectFinish('White')
  await page.waitForTimeout(500)

  expect(await readAllLocalStorage(page)).toEqual(before)
  expect(await readAllSessionStorage(page)).toEqual(sessionBefore)
})

test('a signed-in player’s own fridge is untouched by a shared link', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)
  const mine = await mountApp()
  await mine.root.setNameInput('Mine')
  await mine.root.clickSave()
  await mine.root.verifyChip('Mine')
  await page.reload()
  const before = await readAllLocalStorage(page)
  const sessionBefore = await readAllSessionStorage(page)

  await FridgePagePom.openAt(page, `/b/${SHARED_ID}`)
  const { root } = await mountApp({ seed: seedSharedHello })
  await root.verifyMagnetCount(2)
  await root.verifyNoChip('Mine')
  await root.tapTile('A')
  await page.waitForTimeout(500)

  expect(await readAllLocalStorage(page)).toEqual(before)
  expect(await readAllSessionStorage(page)).toEqual(sessionBefore)
})

test('a signed-in visitor’s legacy fridge is not adopted by opening a shared link', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  // The signed-out first mount left the device's legacy fridge behind.
  const legacy = await readLocalItem(page, 'fridge:v1')
  expect(legacy).not.toBeNull()
  await setFamilyCookie(page, ADA)

  await FridgePagePom.openAt(page, `/b/${SHARED_ID}`)
  const { root } = await mountApp({ seed: seedSharedHello })
  await root.verifyMagnetCount(2)
  await root.tapTile('A')
  await page.waitForTimeout(500)

  expect(await readLocalItem(page, 'fridge:v1')).toBe(legacy)
  expect(await readLocalItem(page, 'fridge:v1@child-ada')).toBeNull()
})

test('the phone’s shared fridge offers keep in place of save, and no saved fridges', async ({
  mountApp,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()

  await FridgePagePom.openAt(page, `/b/${SHARED_ID}`)
  const { root } = await mountApp({ seed: seedSharedHello })
  await root.verifyMagnetCount(2)
  await root.verifyMobileSharedChrome(`/keep/${SHARED_ID}`)
})

test('keeping a shared fridge imports it for the player and opens it', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  // Keep is a full navigation, so the server's gate sees it; here the page opens there.
  await FridgePagePom.openAt(page, `/keep/${SHARED_ID}`)
  const { root } = await mountApp({ seed: seedSharedHello })
  await root.verifyPathIsRoot()
  await root.verifyMagnetCount(2)
  await root.verifyNameInputValue('Shared Hello (shared)')
  await root.verifyActiveChip('Shared Hello (shared)')
  await root.verifyPlayerChip('Ada')
  expect(savedNames(await readLocalItem(page, 'fridge:v1@child-ada'))).toEqual([
    'Shared Hello (shared)',
  ])
})

test('sharing the current board surfaces a /b/ link', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.clickShare()
  await root.verifyShareUrlShown()
})

test('a shared link round-trips through the server back to the same board', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.setNameInput('Poem')
  await root.clickShare()
  // Follow the very link we just minted: board.share → board.get through the
  // simulator's real router + PGlite.
  const id = await root.readShareId()
  await root.gotoSharedBoard(id)
  await root.verifySharedChrome(`/keep/${id}`)
  await root.verifyMagnetCount(8)
  await root.verifyNameInputValue('Poem')
})

test('an unknown shared id shows the not-found state', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.gotoSharedBoard('Missing00x') // valid 10-char shape, absent from the DB
  await root.verifySharedNotFound()
})

test('keeping an unknown shared id shows the not-found state', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()

  await FridgePagePom.openAt(page, '/keep/Missing00x')
  const { root } = await mountApp()
  await root.verifySharedNotFound()
})
