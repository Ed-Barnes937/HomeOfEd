import { expect } from '@playwright/experimental-ct-react'

import { GRID_HEIGHT, SAND } from './sim/index.ts'
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
