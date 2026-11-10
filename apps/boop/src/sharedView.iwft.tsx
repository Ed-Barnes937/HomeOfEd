import { expect } from '@playwright/experimental-ct-react'

import { parseSaveDocument, type StoredBoop } from './persistence/saveFormat.ts'
import { decodeShareHash, encodeShare, SHARE_HASH_PREFIX } from './share/shareLink.ts'
import { readFamilyCalls, seedFamily } from './testing/familySession.ts'
import { HomePagePom } from './testing/HomePagePom.ts'
import { test } from './testing/iwftTest.tsx'
import { readAllLocalStorage, readLocalSave } from './testing/localSaves.ts'

/**
 * `/shared#g=...` is open to anyone and keeps nothing (ADR 0093 decision 6):
 * play it, change it, and the only way to keep it is the root, behind the gate.
 */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const

const SHARED: StoredBoop = {
  name: 'From a friend',
  kitId: 'launch',
  tempo: 110,
  patterns: [
    {
      rows: [
        { instrumentId: 'kick', steps: '1000000000000000' },
        { instrumentId: 'snare', steps: '0000100000000000' },
      ],
    },
  ],
}
const FRAGMENT = `${SHARE_HASH_PREFIX}${encodeShare(SHARED)}`

test('a /shared link opens the boop to play and change, and writes nothing to localStorage', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  const before = await readAllLocalStorage(page)

  await HomePagePom.openAt(page, `/shared${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyTempo(110)
  await root.openClipEditor()
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOn('snare', 4)
  await root.toggleCell('kick', 8)
  await root.verifyCellOn('kick', 8)
  // Past the autosave's lull, then the pagehide flush a reload brings.
  await page.waitForTimeout(3_000)
  expect(await readAllLocalStorage(page)).toEqual(before)
  await page.reload()
  expect(await readAllLocalStorage(page)).toEqual(before)
})

test('with a session, /shared syncs nothing and offers only "Keep this boop"', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedFamily(page, { session: ADA })

  await HomePagePom.openAt(page, `/shared${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyNoSyncedChip()
  await root.verifyNothingOffersToSave()
  await root.verifyKeepShown()
  await page.waitForTimeout(6_000)

  expect(await readFamilyCalls(page)).toEqual([])
})

test('"Keep this boop" carries an untouched fragment byte for byte, past the router', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  // The router decodes `%7B` in the address bar on mount; the kept address must not.
  const escaped = '#g=%7B%22not%22%3A%22a%20boop%22%7D'

  await HomePagePom.openAt(page, `/shared${escaped}`)
  const { root } = await mountApp()
  await root.verifyIsShown()
  const kept = await root.keepBoop()

  expect(kept).toBe(`${new URL(kept).origin}/${escaped}`)
})

test('"Keep this boop" keeps the visitor’s changes', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()

  await HomePagePom.openAt(page, `/shared${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()
  await root.toggleCell('kick', 8)
  const kept = await root.keepBoop()

  expect(new URL(kept).pathname).toBe('/')
  const boop = decodeShareHash(new URL(kept).hash)
  expect(boop?.patterns[0]?.rows.find((row) => row.instrumentId === 'kick')?.steps).toBe(
    '1000000010000000',
  )
})

test('a root #g= link still opens the boop for a signed-in player and keeps it', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedFamily(page, { session: ADA })

  await HomePagePom.openAt(page, `/${FRAGMENT}`)
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyTempo(110)
  await expect.poll(() => new URL(page.url()).hash).toBe('')

  await page.reload()
  expect(parseSaveDocument(await readLocalSave(page, ADA.sub)).working?.tempo).toBe(110)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the shared view’s save icon keeps, and its menu offers nothing to save', async ({
    mountApp,
    page,
  }) => {
    const first = await mountApp()
    await first.root.verifyIsShown()
    await page.reload()

    await HomePagePom.openAt(page, `/shared${FRAGMENT}`)
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyKeepShown()
    await root.openPhoneMenu()
    await root.verifyNothingOffersToSave()
    await expect(page.getByTestId('phone-menu-my-boops')).toHaveCount(0)
  })

  test('the save icon keeps the boop it opened on', async ({ mountApp, page }) => {
    const first = await mountApp()
    await first.root.verifyIsShown()
    await page.reload()

    await HomePagePom.openAt(page, `/shared${FRAGMENT}`)
    const { root } = await mountApp()
    await root.verifyIsShown()
    const kept = await root.keepBoop()

    expect(kept).toBe(`${new URL(kept).origin}/${FRAGMENT}`)
  })
})
