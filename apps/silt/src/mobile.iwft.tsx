import { expect } from '@playwright/experimental-ct-react'

import { DIRT, GRID_HEIGHT, SAND } from './sim/index.ts'
import { test } from './testing/iwftTest.tsx'

const FLOOR = GRID_HEIGHT - 1

// A phone-sized, touch-primary viewport (spec §9, design brief §02): the
// rail rotates into a bottom bar under this rule (HomePage.module.scss's
// $mobile query — `(pointer: coarse), (max-width: 700px)`).
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('the bottom bar replaces the rail: step drops off, play/reset stay, erase is last', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyStepHidden()
  await root.verifyTouchTargetSize('play-toggle')
  await root.verifyTouchTargetSize('reset')
  await root.verifyTouchTargetSize('erase-tool')
  await root.verifyTouchTargetSize('element-sand')
  await root.verifyEraseIsLastInPaletteRow()
})

test('select an element, paint it with a single finger, then run it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('sand')
  expect(await root.isSelected('sand')).toBe(true)
  await root.touchPaintCell(150, FLOOR - 9)
  await root.verifyCellIs(150, FLOOR - 9, SAND)

  await root.play()
  await root.verifyCellIs(150, FLOOR, SAND)
})

// Brush and mode aren't in the mobile spec's explicit rail description, but
// they're shipped desktop capabilities (spec §9, ticket 08) with nothing
// marking them droppable — they fold into the bottom bar's scroll row rather
// than disappearing, so both must stay reachable on a phone.
test('the brush picker is reachable and still widens the brush on a phone', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('dirt')
  await root.selectBrush(2) // 5x5
  expect(await root.isBrushSelected(2)).toBe(true)

  const before = await root.countSpecies(DIRT)
  await root.touchPaintCell(100, 100)
  const after = await root.countSpecies(DIRT)

  expect(after - before).toBeGreaterThan(1)
})

test('spawner mode is reachable and places a spawner via a single-finger tap', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.enterSpawnerMode()
  expect(await root.isSpawnerModeSelected()).toBe(true)

  await root.touchPaintCell(50, 50)
  await root.verifySpawnerAt(50, 50)
})
