import { expect } from '@playwright/experimental-ct-react'

import { SAND } from './sim/index.ts'
import { test } from './testing/iwftTest.tsx'
import { legacySceneKeys, seedLegacyScenes } from './testing/legacyScenes.ts'

/** Where scenes cannot be kept, silt still plays and says so plainly (ADR 0102). */

test('without IndexedDB silt still plays, says scenes cannot be saved, and keeps localStorage free of them', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLegacyScenes(page, [{ id: 'old', name: 'dunes', sand: { x: 40, y: 40 } }])
  // As a browser with IndexedDB disabled or refused behaves.
  await page.evaluate(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('IndexedDB is not allowed here', 'SecurityError')
      },
    })
  })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.paintCell(150, 100)
  await root.verifyCellIs(150, 100, SAND)
  await root.openScenes()
  await root.verifyScenesUnavailable('scenes cannot be saved on this browser')

  // The old scenes are left where they are, and nothing new is written beside them.
  expect(await legacySceneKeys(page)).toEqual(['silt:scene:old', 'silt:scenes', 'silt:thumb:old'])
})

test('an upgrade in another tab is let through, and this tab asks for a reload', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openScenes()

  // Another tab opens a newer version of the store; this tab must not hold it up.
  const upgraded = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const open = window.indexedDB.open('silt', 2)
        open.onsuccess = () => {
          open.result.close()
          resolve(true)
        }
        open.onblocked = () => resolve(false)
      }),
  )
  expect(upgraded).toBe(true)
  await expect
    .poll(() => root.sceneStatus())
    .toBe('silt was updated in another tab, reload to keep saving scenes')

  await root.saveScene()
  expect(await root.sceneStatus()).toBe(
    'silt was updated in another tab, reload to keep saving scenes',
  )
})
