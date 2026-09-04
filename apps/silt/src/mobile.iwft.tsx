import { expect } from '@playwright/experimental-ct-react'

import { DIRT, GRID_HEIGHT, MUD, SAND, SEED } from './sim/index.ts'
import { seedMastery, seedWitnessed } from './testing/fieldNotesSeed.ts'
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
  await root.verifySquareChipSize('element-sand')
  await root.verifySquareChipSize('brush-0')
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

test('the Energy group survives the rotation into the bottom bar', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyPaletteGroupContains('Energy', 'fire')
  await root.verifySquareChipSize('element-fire')
})

/**
 * Materials spec §8: the rail was built for a roster "that will triple" — 12 —
 * and it carries ten base paintables now the discovery tree has taken mud out
 * to be earned (discovery-tree spec §9.5). Checked at phone width rather than
 * assumed: the bottom bar is the tightest place the roster has to fit.
 */
test('the bottom bar still carries the full ten-element base roster', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Rail order is *group* order, not `PAINTABLE_IDS` order — the bar renders
  // Solid, Powder, Liquid, Energy, and every one of the ten is in it.
  expect(await root.paletteElementNames()).toEqual([
    'dirt',
    'wood',
    'stone',
    'sand',
    'seed',
    'water',
    'lava',
    'oil',
    'acid',
    'fire',
  ])
  await root.verifyNoHorizontalPageOverflow()

  // The new chip is still a full-size touch target and still reachable — a
  // swatch that has to be scrolled to is fine, one that cannot be tapped is not.
  await root.verifySquareChipSize('element-seed')
  await root.selectElement('seed')
  expect(await root.isSelected('seed')).toBe(true)
  await root.touchPaintCell(150, FLOOR - 9)
  await root.verifyCellIs(150, FLOOR - 9, SEED)

  // Erase stays at the tail of the same row, behind the new swatch.
  await root.verifyEraseIsLastInPaletteRow()
})

// Field notes is a desktop overlay and a phone takeover of the same DOM
// (discovery-tree spec §6): the picker turns into a wrapped grid of tiles, and
// every one of them still has to be tappable.
test('field notes opens as a full-screen sheet whose picker is still tappable', async ({
  mountApp,
  page,
}) => {
  await seedWitnessed(page, ['react:lava+water'])
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyTouchTargetSize('field-notes-button')
  await root.openFieldNotes()
  await root.verifyTouchTargetSize('field-notes-row-water')
  await root.verifyTouchTargetSize('field-notes-close')

  await root.selectNote('water')
  expect(await root.focusedNote()).toBe('water')
  // The tag chips sit at a fixed offset under the centre name, so the sheet's
  // smaller ring is the layout that could bury them under a spoke tile
  // (ticket 12).
  await root.verifyFocusedNoteTagsAreClearOfTheRing()

  await root.followProduct('obsidian')
  expect(await root.focusedNote()).toBe('obsidian')

  await root.verifyNoHorizontalPageOverflow()
  await root.closeFieldNotes()
})

// The bottom bar is the tightest place an unlock has to fit, and the one where
// the popover has to open upwards instead of off the side of the screen
// (discovery-tree spec §6 "The unlock").
test('an earned element reaches the bottom bar without pushing the page sideways', async ({
  mountApp,
  page,
}) => {
  await seedMastery(page, 'mud')
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Still the ten base elements in the bar itself, plus one control beside them.
  expect(await root.paletteElementNames()).toHaveLength(10)
  await root.verifyTouchTargetSize('earned-button')
  await root.verifyNoHorizontalPageOverflow()

  await root.openEarned()
  await root.selectEarnedElement('mud')
  expect(await root.isEarnedSelected()).toBe(true)
  await root.touchPaintCell(150, FLOOR - 9)
  await root.verifyCellIs(150, FLOOR - 9, MUD)
})
