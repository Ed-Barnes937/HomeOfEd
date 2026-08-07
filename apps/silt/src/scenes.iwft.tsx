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

test('a rename says so, instead of leaving the last save on screen', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openScenes()
  await root.saveScene()
  expect(await root.sceneStatus()).toContain('saved scene 1')

  // Every scene operation reports (spec §8 "loud, never silent") — a stale
  // "saved scene 1" would read as if the rename had not landed.
  await root.renameScene('scene 1', 'dunes')
  expect(await root.sceneStatus()).toContain('dunes')
  expect(await root.sceneStatus()).not.toContain('saved')
})

test('Ctrl+S while renaming a scene does not save a new one', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openScenes()
  await root.saveScene()
  await root.verifySceneRow('scene 1')

  // The rename field is a text input: the hotkeys must all stay out of it,
  // Ctrl+S included, or renaming a scene silently forks a second copy.
  await root.typeInSceneName('scene 1', 'dun')
  await root.pressKey('Control+s')
  await root.verifyNoSceneRow('scene 2')
})
