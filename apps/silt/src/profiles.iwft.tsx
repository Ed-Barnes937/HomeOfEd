import { expect } from '@playwright/experimental-ct-react'

import { SAND } from './sim/index.ts'
import { readSiltKeys, sceneNames, setFamilyCookie } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'
import type { SiltPagePom } from './testing/SiltPagePom.ts'

/** Scenes and field notes belong to whoever is playing (ADR 0094, estate-gate ticket 12). */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

/** Water dropped onto lava: obsidian and steam, one charted entry (the fixed seed makes it exact). */
async function witnessObsidian(root: SiltPagePom): Promise<void> {
  await root.selectBrush(2)
  await root.selectElement('lava')
  await root.paintCell(150, 120)
  await root.selectElement('water')
  await root.paintCell(150, 115)
  await root.step()
  await expect.poll(() => root.fieldNotesCount()).toBe('1/54')
}

async function saveASandScene(root: SiltPagePom): Promise<void> {
  await root.selectElement('sand')
  await root.paintCell(40, 40)
  await root.openScenes()
  await root.saveScene()
  await root.verifySceneRow('scene 1')
  await root.closeScenes()
}

test('one player’s scenes and field notes are not another’s on the same device', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, ADA)

  const ada = await mountApp()
  await ada.root.verifyIsShown()
  await witnessObsidian(ada.root)
  await saveASandScene(ada.root)

  await page.reload()
  await setFamilyCookie(page, BO)
  const bo = await mountApp()
  await bo.root.verifyIsShown()
  expect(await bo.root.fieldNotesCount()).toBe('0/54')
  await bo.root.openScenes()
  expect(await bo.root.sceneRowCount()).toBe(0)

  expect(await sceneNames(page, ADA.sub)).toEqual(['scene 1'])
  expect(await sceneNames(page, null)).toBeNull()
  const stored = await readSiltKeys(page)
  expect(Object.keys(stored).filter((key) => key.endsWith(`@${BO.sub}`))).toEqual([])
  expect(stored['silt:fieldNotes']).toBeUndefined()
})

test('scenes and field notes from before profiles appear for every player, and the device’s copies are never touched', async ({
  mountApp,
  page,
}) => {
  const before = await mountApp()
  await before.root.verifyIsShown()
  await witnessObsidian(before.root)
  await saveASandScene(before.root)
  const legacy = await readSiltKeys(page)

  for (const player of [ADA, BO]) {
    await page.reload()
    await setFamilyCookie(page, player)
    const { root } = await mountApp()
    await root.verifyIsShown()
    expect(await root.fieldNotesCount()).toBe('1/54')
    await root.openScenes()
    await root.verifySceneThumbnail('scene 1')
    await root.loadScene('scene 1')
    await root.verifyCellIs(40, 40, SAND)
    // Saving over the adopted scene writes the player's copy, never the device's.
    await root.paintCell(60, 40)
    await root.openScenes()
    await root.saveScene()
    await expect.poll(() => root.sceneStatus()).toBe('saved scene 1')
  }

  const after = await readSiltKeys(page)
  for (const [key, value] of Object.entries(legacy)) expect(after[key]).toBe(value)
  expect(await sceneNames(page, ADA.sub)).toEqual(['scene 1'])
  expect(await sceneNames(page, BO.sub)).toEqual(['scene 1'])
})

test('deleting a scene in one profile leaves the other’s, and it stays deleted', async ({
  mountApp,
  page,
}) => {
  const before = await mountApp()
  await before.root.verifyIsShown()
  await saveASandScene(before.root)

  await page.reload()
  await setFamilyCookie(page, BO)
  const bo = await mountApp()
  await bo.root.verifyIsShown()
  await bo.root.openScenes()
  await bo.root.verifySceneRow('scene 1')

  await page.reload()
  await setFamilyCookie(page, ADA)
  const ada = await mountApp()
  await ada.root.verifyIsShown()
  await ada.root.openScenes()
  await ada.root.deleteScene('scene 1')
  await ada.root.verifyNoSceneRow('scene 1')

  // Ada's next open does not adopt the device's scene again.
  await page.reload()
  await setFamilyCookie(page, ADA)
  const adaAgain = await mountApp()
  await adaAgain.root.verifyIsShown()
  await adaAgain.root.openScenes()
  expect(await adaAgain.root.sceneRowCount()).toBe(0)

  await page.reload()
  await setFamilyCookie(page, BO)
  const boAgain = await mountApp()
  await boAgain.root.verifyIsShown()
  await boAgain.root.openScenes()
  await boAgain.root.verifySceneRow('scene 1')
  expect(await sceneNames(page, null)).toEqual(['scene 1'])
})
