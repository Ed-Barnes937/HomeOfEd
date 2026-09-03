import { expect } from '@playwright/experimental-ct-react'

import { DIRT, EMPTY, GRID_HEIGHT, SAND } from './sim/index.ts'
import { test } from './testing/iwftTest.tsx'

const FLOOR = GRID_HEIGHT - 1

test('the first-visit hint fades on the first stroke and never returns', async ({ mountApp, page }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyFirstVisitHintVisible()

  await root.paintCell(50, 50)
  await root.verifyFirstVisitHintFadingOut()
  await root.verifyFirstVisitHintGone()

  // Reset clears the world but the hint stays gone (spec §9: "never returns").
  await root.confirmReset()
  await root.verifyFirstVisitHintGone()

  // "Never returns" has to hold for a returning visitor too, not just within
  // one page load — a reload before painting again must not bring it back
  // (ticket 18).
  await page.reload()
  const { root: reloaded } = await mountApp()
  await reloaded.verifyIsShown()
  await reloaded.verifyFirstVisitHintGone()
})

test('erase is a tool, not a palette entry, and clears painted cells', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('dirt')
  await root.paintCell(30, 30)
  await root.verifyCellIs(30, 30, DIRT)

  await root.selectErase()
  expect(await root.isEraseSelected()).toBe(true)
  // Erase supersedes the palette selection.
  expect(await root.isSelected('dirt')).toBe(false)

  await root.paintCell(30, 30)
  await root.verifyCellIs(30, 30, EMPTY)
})

test('a wider brush paints more than one cell at a time', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('dirt')
  await root.selectBrush(2) // 5x5
  expect(await root.isBrushSelected(2)).toBe(true)

  const before = await root.countSpecies(DIRT)
  await root.paintCell(100, 100)
  const after = await root.countSpecies(DIRT)

  expect(after - before).toBeGreaterThan(1)
})

test('step advances exactly one tick while paused, and is disabled while running', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('sand')
  await root.paintCell(150, FLOOR - 5)
  await root.verifyCellIs(150, FLOOR - 5, SAND)

  await root.step()
  await root.verifyCellIs(150, FLOOR - 4, SAND)
  await root.verifyCellIs(150, FLOOR - 5, EMPTY)

  await root.play()
  await root.verifyRunning()
})

test('reset needs a second click, then clears the world', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('dirt')
  await root.paintCell(60, 60)
  await root.verifyCellIs(60, 60, DIRT)

  await root.clickReset()
  expect(await root.isResetArmed()).toBe(true)
  // Still armed, not yet cleared.
  await root.verifyCellIs(60, 60, DIRT)

  await root.clickReset()
  await root.verifyCellIs(60, 60, EMPTY)
})

test('the running pill and paused grid state track play/pause', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPaused()

  await root.play()
  await root.verifyRunning()

  await root.play()
  await root.verifyPaused()
})

test('the status bar reflects the selected tool, brush, and grid size', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('water')
  expect(await root.statusText('status-element')).toBe('water')

  await root.selectBrush(1)
  expect(await root.statusText('status-brush')).toContain('3')

  expect(await root.statusText('status-grid-size')).toContain('300')
  expect(await root.statusText('status-grid-size')).toContain('200')
})

test('keyboard shortcuts select elements, change brush, and toggle play/step', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.pressKey('2')
  expect(await root.isSelected('sand')).toBe(true)

  await root.pressKey(']')
  expect(await root.isBrushSelected(1)).toBe(true)

  await root.pressKey('e')
  expect(await root.isEraseSelected()).toBe(true)

  await root.pressKey('Space')
  await root.verifyRunning()
  await root.pressKey('Space')
  await root.verifyPaused()
})

// The rail has had a group for Energy since v1 and nothing to put in it (spec
// §9). Fire is the first energy element, so this is the first time the section
// renders at all.
test('the rail advertises a hotkey only where one exists', async ({ mountApp, page }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Digits stop at `HOTKEYED_ENTRIES` (nine) and the roster is eleven
  // paintables. The first nine carry a badge; mud and seed must not claim a
  // dead key. Asserting the *badge* is absent, not that some particular text
  // is: "no element reading 10" also passes when the badge renders "99".
  await expect(page.getByTestId('element-dirt').getByTestId('hotkey-badge')).toHaveText('1')
  await expect(page.getByTestId('element-mud').getByTestId('hotkey-badge')).toHaveCount(0)
  await expect(page.getByTestId('element-seed').getByTestId('hotkey-badge')).toHaveCount(0)
  // And exactly nine of them exist in the rail, so the cut is where it says.
  await expect(page.getByTestId('palette').getByTestId('hotkey-badge')).toHaveCount(9)

  // The swatch still works; it just does not claim a shortcut.
  await root.selectElement('mud')
  expect(await root.isSelected('mud')).toBe(true)
})

test('the Energy group appears in the rail now fire is paintable', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyPaletteGroupContains('Energy', 'fire')
  await root.verifyPaletteGroupContains('Solid', 'wood')
  await root.verifyPaletteGroupContains('Liquid', 'oil')

  await root.selectElement('fire')
  expect(await root.isSelected('fire')).toBe(true)
})

// Mud is a reaction product that is still paintable in its own right, unlike
// obsidian — so unlike smoke and steam, it has to reach the rail.
test('mud is paintable and sits in the Liquid group', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyPaletteGroupContains('Liquid', 'mud')

  await root.selectElement('mud')
  expect(await root.isSelected('mud')).toBe(true)
})

// Seed is the eleventh paintable, and the roster's last: moss and vine are the
// reward for planting it, so neither reaches the rail.
test('seed is paintable and sits in the Powder group, with no plant beside it', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyPaletteGroupContains('Powder', 'seed')

  await root.selectElement('seed')
  expect(await root.isSelected('seed')).toBe(true)

  const names = await root.paletteElementNames()
  // Every plant is a reward rather than a swatch (life spec ruling 6), the land
  // roster included: the rail stays at eleven.
  for (const plant of ['moss', 'vine', 'buried', 'sprout', 'tip', 'stalk', 'flower']) {
    expect(names).not.toContain(plant)
  }
})
