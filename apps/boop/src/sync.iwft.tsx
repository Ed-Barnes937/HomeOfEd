import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import { parseSaveDocument, type StoredBoop } from './persistence/saveFormat.ts'
import { SAVE_KEY } from './persistence/storage.ts'
import { readRemoteSave, seedFamily } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'
import { SYNCED_ACCOUNT_KEY } from './sync/syncedAccount.ts'

/**
 * boop as the first SaveStore client (ADR 0080, first-slice spec §7). The
 * property every test here is really about: localStorage is the source of
 * truth, the account is a copy of it, and a child whose family service is
 * missing, broken or slow gets exactly today's boop.
 */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const

function boop(name: string): StoredBoop {
  return {
    name,
    kitId: 'launch',
    tempo: 100,
    patterns: [{ rows: [{ instrumentId: 'kick', steps: '1000000000000000' }] }],
  }
}

function saveDocument(creations: readonly StoredBoop[]): string {
  return JSON.stringify({ version: 1, working: null, creations })
}

async function seedLocal(page: Page, blob: string): Promise<void> {
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: SAVE_KEY, value: blob },
  )
}

async function readLocal(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY)
}

function savedNames(blob: string | null): readonly string[] {
  return parseSaveDocument(blob).creations.map((creation) => creation.name)
}

/** Stamp the marker, which is what a device that has answered the offer carries. */
async function stampMarker(page: Page, accountId: string): Promise<void> {
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify([value])),
    { key: SYNCED_ACCOUNT_KEY, value: accountId },
  )
}

// Every test seeds the same way: mount once so the page has an origin to write
// to, reload so the first app's autosave flush cannot land on top of the seed,
// then seed and mount the app under test.
test('with no family session, boop never touches the save service', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  // The service is up and would accept a write; boop simply has no session.
  await seedFamily(page, { session: ADA, cookie: false })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await page.waitForTimeout(6_000)

  expect(await readRemoteSave(page)).toBeNull()
  await root.verifyNoSyncedChip()
  await root.verifyNoImportOffer()
})

test('the first link offers to keep this device’s boops, and accepting copies them up', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLocal(page, saveDocument([boop('on the tablet')]))
  await seedFamily(page, { session: ADA, remote: saveDocument([boop('on the phone')]) })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyImportOfferShown('Ada')
  await root.acceptImport()

  await root.verifyNoImportOffer()
  await root.verifySyncedChip('Ada')
  await expect
    .poll(async () => savedNames(await readRemoteSave(page)))
    .toEqual(['on the phone', 'on the tablet'])
  expect(savedNames(await readLocal(page))).toEqual(['on the phone', 'on the tablet'])
  expect(await root.readSyncedAccounts()).toEqual([ADA.sub])
})

test('declining keeps everything local and is never asked again', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLocal(page, saveDocument([boop('on the tablet')]))
  await seedFamily(page, { session: ADA })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.declineImport()

  await page.waitForTimeout(6_000)
  expect(await readRemoteSave(page)).toBeNull()
  expect(savedNames(await readLocal(page))).toEqual(['on the tablet'])

  await page.reload()
  const second = await mountApp()
  await second.root.verifyIsShown()
  await second.root.verifyNoImportOffer()
})

test('a boop made on another device arrives in "My boops" at start', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLocal(page, saveDocument([boop('on the tablet')]))
  await stampMarker(page, ADA.sub)
  await seedFamily(page, { session: ADA, remote: saveDocument([boop('on the phone')]) })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifySyncedChip('Ada')
  await expect.poll(async () => savedNames(await readLocal(page))).toEqual([
    'on the phone',
    'on the tablet',
  ])

  await root.openBoops()
  await root.verifyBoopName(0, 'on the phone')
  await root.verifyBoopName(1, 'on the tablet')
})

test('saving a boop copies the whole document up', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await stampMarker(page, ADA.sub)
  await seedFamily(page, { session: ADA })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.openBoops()
  const name = await root.saveBoop()
  await root.closeBoops()

  await expect.poll(async () => savedNames(await readRemoteSave(page))).toEqual([name])
})

test('a family service that throws on every call leaves boop exactly as it is today', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLocal(page, saveDocument([boop('on the tablet')]))
  await stampMarker(page, ADA.sub)
  await seedFamily(page, { session: ADA, broken: true })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await page.waitForTimeout(6_000)

  // Nothing blocked, nothing errored, and the child's work is on disk.
  await root.verifyIsShown()
  await root.openClipEditor()
  await root.verifyCellOn('kick', 0)
  expect(savedNames(await readLocal(page))).toContain('on the tablet')
  expect(await readLocal(page)).not.toBeNull()
})

test('a remote blob that is not a boop save degrades to empty rather than erroring', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLocal(page, saveDocument([boop('on the tablet')]))
  await stampMarker(page, ADA.sub)
  await seedFamily(page, { session: ADA, remote: '{"version":99,"wrong":"shape"' })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifySyncedChip('Ada')

  await root.openBoops()
  await root.verifyBoopName(0, 'on the tablet')
  await root.closeBoops()
  expect(savedNames(await readLocal(page))).toEqual(['on the tablet'])
})
