import { expect } from '@playwright/experimental-ct-react'

import { EMPTY, WATER } from './sim/index.ts'
import { test } from './testing/iwftTest.tsx'

test('spawner mode places a spawner, and status bar counts and names it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.enterSpawnerMode()
  expect(await root.isSpawnerModeSelected()).toBe(true)
  expect(await root.modeText()).toBe('spawner')

  await root.clickCell(40, 40)
  await root.verifySpawnerAt(40, 40)
  expect(await root.spawnerCount()).toContain('1')
})

test('clicking a placed spawner again removes it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.enterSpawnerMode()
  await root.clickCell(40, 40)
  await root.verifySpawnerAt(40, 40)

  await root.clickCell(40, 40)
  await root.verifyNoSpawnerAt(40, 40)
  expect(await root.spawnerCount()).toContain('0')
})

test('a water spawner placed while paused emits once the sim runs, and stops when paused', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('water')
  await root.enterSpawnerMode()
  await root.clickCell(150, 20)

  // Placement works while paused, but nothing emits yet.
  await root.verifyCellIs(150, 20, EMPTY)

  await root.play()
  await expect.poll(() => root.countSpecies(WATER)).toBeGreaterThan(0)

  await root.play() // back to paused
  const settled = await root.countSpecies(WATER)
  await page.waitForTimeout(300)
  expect(await root.countSpecies(WATER)).toBe(settled)
})

test('reset clears spawners along with cells', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.enterSpawnerMode()
  await root.clickCell(70, 70)
  await root.verifySpawnerAt(70, 70)

  await root.confirmReset()
  await root.verifyNoSpawnerAt(70, 70)
  expect(await root.spawnerCount()).toContain('0')
})
