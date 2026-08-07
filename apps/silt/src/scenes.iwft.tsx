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

test('saving again writes over the scene being edited instead of forking a second one', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.paintCell(150, 100)
  await root.openScenes()
  await root.saveScene()
  await root.verifySceneRow('scene 1')

  await root.closeScenes()
  await root.paintCell(160, 100)
  await root.openScenes()
  await root.saveScene()

  // One scene, saved twice — not two scenes (the ~240KB-a-save quota bug).
  await root.verifySceneRow('scene 1')
  await root.verifyNoSceneRow('scene 2')
  expect(await root.sceneRowCount()).toBe(1)

  // And it is the *second* world that is now in the row.
  await root.closeScenes()
  await root.confirmReset()
  await root.openScenes()
  await root.loadScene('scene 1')
  expect(await root.countSpecies(SAND)).toBe(2)
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

test('the header names the scene a save would write to, through a save and a rename', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  expect(await root.headerSceneName()).toBe('untitled')

  await root.openScenes()
  await root.saveScene()
  expect(await root.headerSceneName()).toBe('scene 1')

  await root.renameScene('scene 1', 'dunes')
  expect(await root.headerSceneName()).toBe('dunes')
})

test('reset lets go of the scene, so the next save does not empty it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.paintCell(150, 100)
  await root.openScenes()
  await root.saveScene()
  await root.closeScenes()

  // Reset clears the world, so what is on screen is nobody's scene any more —
  // saving it must not write an empty world over the one just saved.
  await root.confirmReset()
  expect(await root.headerSceneName()).toBe('untitled')

  await root.paintCell(160, 100)
  await root.openScenes()
  await root.saveScene()
  await root.verifySceneRow('scene 2')

  await root.loadScene('scene 1')
  await root.verifyCellIs(150, 100, SAND)
})

test('a scene can be forked with duplicate, which save-over-the-current no longer does', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.paintCell(150, 100)
  await root.openScenes()
  await root.saveScene()

  await root.duplicateScene('scene 1')
  await root.verifySceneRow('scene 1 copy')
  expect(await root.sceneRowCount()).toBe(2)

  // The copy is a keepsake: what is on screen is still `scene 1`, and that is
  // what the next save writes to.
  expect(await root.headerSceneName()).toBe('scene 1')
  await root.saveScene()
  expect(await root.sceneRowCount()).toBe(2)

  // Loading the copy is how you carry on inside the fork.
  await root.loadScene('scene 1 copy')
  expect(await root.headerSceneName()).toBe('scene 1 copy')
})

test('each row shows when it was last saved', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openScenes()
  await root.saveScene()

  // `updatedAt` is what tells you which scene you touched last, so it is on
  // the row rather than only in storage.
  expect(await root.sceneUpdatedAt('scene 1')).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/)
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

test('Ctrl+S while renaming a scene does not write over it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.paintCell(150, 100)
  await root.openScenes()
  await root.saveScene()
  await root.verifySceneRow('scene 1')

  // A world that has moved on since the save.
  await root.closeScenes()
  await root.paintCell(160, 100)
  await root.openScenes()

  // The rename field is a text input: the hotkeys must all stay out of it,
  // Ctrl+S included, or renaming a scene silently saves over it. Same text, so
  // the blur that follows is not itself a rename.
  await root.typeInSceneName('scene 1', 'scene 1')
  await root.pressKey('Control+s')
  expect(await root.sceneRowCount()).toBe(1)

  await root.loadScene('scene 1')
  expect(await root.countSpecies(SAND)).toBe(1)
})
