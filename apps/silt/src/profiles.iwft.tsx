import { expect } from '@playwright/experimental-ct-react'

import { entryIndex } from './features/fieldNotes/entries.ts'
import { SAND } from './sim/index.ts'
import { readSiltKeys, sceneNames, setFamilyCookie } from './testing/familySession.ts'
import { seedWitnessed } from './testing/fieldNotesSeed.ts'
import { test } from './testing/iwftTest.tsx'
import { legacySceneKeys, seedLegacyScenes } from './testing/legacyScenes.ts'
import type { SiltPagePom } from './testing/SiltPagePom.ts'

/** Scenes and field notes belong to whoever is playing (ADR 0094, ADR 0102). */

const ADA = { sub: 'child-ada', role: 'child', parentId: 'parent-1', name: 'Ada' } as const
const BO = { sub: 'child-bo', role: 'child', parentId: 'parent-1', name: 'Bo' } as const

const FROM_BEFORE = [
  { id: 'old-dunes', name: 'dunes', sand: { x: 40, y: 40 } },
  { id: 'old-pond', name: 'pond', sand: { x: 80, y: 40 } },
]

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

async function openAs(
  page: import('@playwright/test').Page,
  mountApp: () => Promise<{ root: SiltPagePom }>,
  player: typeof ADA | typeof BO,
): Promise<SiltPagePom> {
  await page.reload()
  await setFamilyCookie(page, player)
  const { root } = await mountApp()
  await root.verifyIsShown()
  return root
}

test('one player’s scenes and field notes are not another’s, and come back after a reload', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  const ada = await openAs(page, mountApp, ADA)
  await witnessObsidian(ada)
  await saveASandScene(ada)

  const bo = await openAs(page, mountApp, BO)
  expect(await bo.fieldNotesCount()).toBe('0/54')
  await bo.openScenes()
  expect(await bo.sceneRowCount()).toBe(0)

  const adaAgain = await openAs(page, mountApp, ADA)
  await adaAgain.openScenes()
  await adaAgain.loadScene('scene 1')
  await adaAgain.verifyCellIs(40, 40, SAND)

  expect(await sceneNames(page, ADA.sub)).toEqual(['scene 1'])
  expect(await sceneNames(page, BO.sub)).toEqual([])
  expect(await sceneNames(page, null)).toEqual([])
  const stored = await readSiltKeys(page)
  expect(Object.keys(stored).filter((key) => key.endsWith(`@${BO.sub}`))).toEqual([])
  expect(stored['silt:fieldNotes']).toBeUndefined()
})

test('scenes from before move out of localStorage once, and every player gets them', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLegacyScenes(page, FROM_BEFORE)
  await seedWitnessed(page, ['react:lava+water'])

  const ada = await openAs(page, mountApp, ADA)
  expect(await ada.fieldNotesCount()).toBe('1/54')
  await ada.openScenes()
  await ada.verifySceneThumbnail('dunes')
  expect(await sceneNames(page, ADA.sub)).toEqual(['dunes', 'pond'])
  expect(await legacySceneKeys(page)).toEqual([])
  // Ada saves over her copy; the device's and Bo's stay as they were.
  await ada.loadScene('dunes')
  await ada.verifyCellIs(40, 40, SAND)
  await ada.paintCell(60, 40)
  await ada.openScenes()
  await ada.saveScene()
  await expect.poll(() => ada.sceneStatus()).toBe('saved dunes')

  const bo = await openAs(page, mountApp, BO)
  expect(await bo.fieldNotesCount()).toBe('1/54')
  await bo.openScenes()
  await bo.loadScene('dunes')
  await bo.verifyCellIs(40, 40, SAND)
  expect(await bo.speciesAt(60, 40)).not.toBe(SAND)

  expect(await sceneNames(page, null)).toEqual(['dunes', 'pond'])
  expect(await sceneNames(page, BO.sub)).toEqual(['dunes', 'pond'])
})

test('deleting a scene in one profile leaves the other’s, and it stays deleted', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedLegacyScenes(page, FROM_BEFORE.slice(0, 1))

  const bo = await openAs(page, mountApp, BO)
  await bo.openScenes()
  await bo.verifySceneRow('dunes')

  const ada = await openAs(page, mountApp, ADA)
  await ada.openScenes()
  await ada.deleteScene('dunes')
  await ada.verifyNoSceneRow('dunes')

  const adaAgain = await openAs(page, mountApp, ADA)
  await adaAgain.openScenes()
  expect(await adaAgain.sceneRowCount()).toBe(0)

  const boAgain = await openAs(page, mountApp, BO)
  await boAgain.openScenes()
  await boAgain.verifySceneRow('dunes')
  expect(await sceneNames(page, null)).toEqual(['dunes'])
})

test('forgotten discoveries stay forgotten, even with the device’s old notes still there', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await seedWitnessed(page, ['react:lava+water'])

  const ada = await openAs(page, mountApp, ADA)
  expect(await ada.fieldNotesCount()).toBe('1/54')
  await ada.openFieldNotes()
  await ada.forgetDiscoveries()
  await ada.closeFieldNotes()
  expect(await ada.fieldNotesCount()).toBe('0/54')

  const adaAgain = await openAs(page, mountApp, ADA)
  expect(await adaAgain.fieldNotesCount()).toBe('0/54')
})

test('signed out, the header names no player', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyNoPlayer()
})

async function openAsAda(
  page: import('@playwright/test').Page,
  mountApp: () => Promise<{ root: SiltPagePom }>,
): Promise<SiltPagePom> {
  const first = await mountApp()
  await first.root.verifyIsShown()
  const ada = await openAs(page, mountApp, ADA)
  await ada.verifyPlayer('Ada')
  return ada
}

test.describe('on a laptop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('who is playing is their initial at the end of the header', async ({ mountApp, page }) => {
    const ada = await openAsAda(page, mountApp)
    await ada.verifyPlayerEndsHeader('Ada')
  })
})

for (const width of [390, 320]) {
  test.describe(`on a ${width}px phone`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true })

    test('who is playing is a full-size circle at the end of the header, on the glass', async ({
      mountApp,
      page,
    }) => {
      const ada = await openAsAda(page, mountApp)
      await ada.verifyPlayerEndsHeader('Ada')
      await ada.verifyTitleClearOfControls()
      await ada.verifyTouchTargetSize('switch-player')
      await ada.verifyNoHorizontalPageOverflow()
    })
  })
}

test.describe('on a 360px phone', () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true })

  test('the widest header, a full chart and reset armed, still fits beside the circle', async ({
    mountApp,
    page,
  }) => {
    const first = await mountApp()
    await first.root.verifyIsShown()
    await seedWitnessed(page, entryIndex().witnessKeys)
    const ada = await openAs(page, mountApp, ADA)
    expect(await ada.fieldNotesCount()).toBe('54/54')
    await ada.clickReset()

    await ada.verifyPlayerEndsHeader('Ada')
    await ada.verifyTitleClearOfControls()
    await ada.verifyNoHorizontalPageOverflow()
  })
})
