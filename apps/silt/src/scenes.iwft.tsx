import { expect } from '@playwright/experimental-ct-react'

import { SAND } from './sim/index.ts'
import { test } from './testing/iwftTest.tsx'

test('a painted world survives a save, a page reload and a load — arriving paused', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  await first.root.paintCell(150, 100)
  await first.root.verifyCellIs(150, 100, SAND)

  await first.root.openScenes()
  await first.root.saveScene()
  await first.root.verifySceneRow('scene 1')
  await first.root.verifySceneThumbnail('scene 1')

  await page.reload()
  const { root } = await mountApp()
  await root.verifyIsShown()

  // A fresh world: the scene only exists in storage until it is loaded.
  expect(await root.countSpecies(SAND)).toBe(0)

  await root.openScenes()
  await root.loadScene('scene 1')

  await root.verifyCellIs(150, 100, SAND)
  expect(await root.countSpecies(SAND)).toBe(1)
  await root.verifyPaused()
  expect(await root.headerSceneName()).toBe('scene 1')
})

test('a loaded scene brings its spawners with it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('water')
  await root.enterSpawnerMode()
  await root.clickCell(150, 20)
  await root.verifySpawnerAt(150, 20)

  await root.openScenes()
  await root.saveScene()
  await root.closeScenes()
  await root.confirmReset()
  await root.verifyNoSpawnerAt(150, 20)

  await root.openScenes()
  await root.loadScene('scene 1')
  await root.verifySpawnerAt(150, 20)
  expect(await root.spawnerCount()).toContain('1')
})

test('scenes can be renamed inline and deleted behind a second click', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openScenes()
  await root.saveScene()
  await root.verifySceneRow('scene 1')

  await root.renameScene('scene 1', 'dunes')
  await root.verifySceneRow('dunes')
  await root.verifyNoSceneRow('scene 1')

  await root.deleteScene('dunes')
  await root.verifyNoSceneRow('dunes')
})
