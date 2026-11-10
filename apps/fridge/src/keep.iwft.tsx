import type { MountApp } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import {
  readLocalItem,
  readSessionItem,
  setFamilyCookie,
  writeSessionItem,
} from './testing/familySession.ts'
import { FridgePagePom } from './testing/FridgePagePom.ts'
import { test } from './testing/iwftTest.tsx'
import { seedSharedHello, SHARED_ID } from './testing/sharedBoardSeed.ts'

/**
 * Keep carries the visitor's edits (ADR 0010, amended): pressing it stashes the
 * edited board in this tab's sessionStorage for `/keep/<id>`, which takes it once.
 */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const
const KEEP_KEY = 'fridge:keep'

const OTHER_BOARD = {
  name: 'Somebody else',
  finish: 'white',
  wall: 'warm',
  magnets: [{ type: 'number', label: '7', deg: 0, color: 'green', x: 400, y: 100, rot: 0 }],
}

async function pressKeepOnShared(
  page: Page,
  mountApp: MountApp<FridgePagePom>,
  edit: (root: FridgePagePom) => Promise<void>,
): Promise<void> {
  await FridgePagePom.openAt(page, `/b/${SHARED_ID}`)
  const { root } = await mountApp({ seed: seedSharedHello })
  await root.verifyMagnetCount(2)
  await edit(root)
  await root.pressKeep()
}

async function openKeep(page: Page, mountApp: MountApp<FridgePagePom>): Promise<FridgePagePom> {
  // The harness only serves its own page, so reload from there, not from /b/<id>.
  await FridgePagePom.openAt(page, '/')
  await page.reload()
  await setFamilyCookie(page, ADA)
  await FridgePagePom.openAt(page, `/keep/${SHARED_ID}`)
  const { root } = await mountApp({ seed: seedSharedHello })
  await root.verifyPathIsRoot()
  return root
}

function storedCurrent(raw: string | null): { name: string; magnets: unknown[] } {
  return (JSON.parse(raw ?? 'null') as { current: { name: string; magnets: unknown[] } }).current
}

test('keeping an edited shared fridge keeps the edits, and takes the stash once', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await pressKeepOnShared(page, mountApp, async (root) => {
    await root.tapTile('A')
    await root.verifyMagnetCount(3)
  })
  expect(await readSessionItem(page, KEEP_KEY)).not.toBeNull()

  const root = await openKeep(page, mountApp)
  await root.verifyMagnetCount(3)
  await root.verifyNameInputValue('Shared Hello (shared)')
  await root.verifyActiveChip('Shared Hello (shared)')
  expect(storedCurrent(await readLocalItem(page, 'fridge:v1@child-ada')).magnets).toHaveLength(3)
  expect(await readSessionItem(page, KEEP_KEY)).toBeNull()
})

test('keeping an unedited shared fridge stashes nothing, and clears an earlier stash', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await writeSessionItem(page, KEEP_KEY, JSON.stringify({ id: SHARED_ID, board: OTHER_BOARD }))
  await pressKeepOnShared(page, mountApp, async () => {})
  expect(await readSessionItem(page, KEEP_KEY)).toBeNull()

  const root = await openKeep(page, mountApp)
  await root.verifyMagnetCount(2)
  await root.verifyNameInputValue('Shared Hello (shared)')
})

test('a stash for another shared fridge is ignored and left alone', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  const stash = JSON.stringify({ id: 'OtherBoard', board: OTHER_BOARD })
  await writeSessionItem(page, KEEP_KEY, stash)

  const root = await openKeep(page, mountApp)
  await root.verifyMagnetCount(2)
  await root.verifyNameInputValue('Shared Hello (shared)')
  expect(await readSessionItem(page, KEEP_KEY)).toBe(stash)
})

for (const [kind, malformed] of [
  ['unreadable', '{not json'],
  ['not a board', JSON.stringify({ id: SHARED_ID, board: { name: 'bad', magnets: 'lots' } })],
] as const) {
  test(`a stash that is ${kind} is dropped and the shared fridge is kept as shared`, async ({
    mountApp,
    page,
  }) => {
    const first = await mountApp()
    await first.root.verifyIsShown()
    await page.reload()
    await writeSessionItem(page, KEEP_KEY, malformed)

    const root = await openKeep(page, mountApp)
    await root.verifyMagnetCount(2)
    await root.verifyNameInputValue('Shared Hello (shared)')
    expect(await readSessionItem(page, KEEP_KEY)).toBeNull()
  })
}
