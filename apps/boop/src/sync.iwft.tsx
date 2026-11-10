import { expect } from '@playwright/experimental-ct-react'

import { readFamilyCalls, readRemoteSave, seedFamily } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'
import {
  boop,
  readLocalSave,
  saveDocument,
  savedNames,
  seedLegacySave,
} from './testing/localSaves.ts'

/**
 * boop as the first SaveStore client (ADR 0080, first-slice spec §7). The
 * property every test here is really about: localStorage is the source of
 * truth, the account is a copy of it, and a child whose family service is
 * missing, broken or slow gets exactly today's boop.
 */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const

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
  expect(await readFamilyCalls(page)).toEqual([])
  await root.verifyNoSyncedChip()
})

test('the first open with a session copies this device’s boops up without asking', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLegacySave(page, saveDocument([boop('on the tablet')]))
  // What a device that declined the old import offer carries (ADR 0080 as
  // amended): the answer is no longer read, so it syncs like any other.
  await page.evaluate(() =>
    window.localStorage.setItem('boop:syncedAccount', JSON.stringify({ 'child-ada': 'declined' })),
  )
  await seedFamily(page, { session: ADA, remote: saveDocument([boop('on the phone')]) })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifySyncedChip('Ada')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect
    .poll(async () => savedNames(await readRemoteSave(page)))
    .toEqual(['on the phone', 'on the tablet'])
  expect(savedNames(await readLocalSave(page, ADA.sub))).toEqual(['on the phone', 'on the tablet'])
  expect(savedNames(await readLocalSave(page, null))).toEqual(['on the tablet'])
})

test('a boop made on another device arrives in "My boops" at start', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLegacySave(page, saveDocument([boop('on the tablet')]))
  await seedFamily(page, { session: ADA, remote: saveDocument([boop('on the phone')]) })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifySyncedChip('Ada')
  await expect
    .poll(async () => savedNames(await readLocalSave(page, ADA.sub)))
    .toEqual(['on the phone', 'on the tablet'])

  await root.openBoops()
  await root.verifyBoopName(0, 'on the phone')
  await root.verifyBoopName(1, 'on the tablet')
})

test('saving a boop copies the whole document up', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
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
  await seedLegacySave(page, saveDocument([boop('on the tablet')]))
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
  expect(savedNames(await readLocalSave(page, ADA.sub))).toContain('on the tablet')
})

test('a remote document boop cannot read is left exactly where it is', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLegacySave(page, saveDocument([boop('on the tablet')]))
  // What a stale bundle sees of a newer document, which is a deploy away.
  const future = '{"version":99,"working":null,"creations":[]}'
  await seedFamily(page, { session: ADA, remote: future })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifySyncedChip('Ada')
  await root.startBlank()
  await root.toggleCell('kick', 0)
  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await page.waitForTimeout(6_000)

  // Nothing errored at the child, the local boops are untouched, and the
  // document boop could not read is still on the account rather than replaced
  // by this device's.
  await root.openBoops()
  await root.verifyBoopName(0, 'on the tablet')
  await root.closeBoops()
  expect(savedNames(await readLocalSave(page, ADA.sub))).toContain('on the tablet')
  expect(await readRemoteSave(page)).toBe(future)
})
