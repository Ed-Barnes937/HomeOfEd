import { expect } from '@playwright/experimental-ct-react'

import { DIRT, EMPTY, GRID_HEIGHT, SAND } from './sim/index.ts'
import { test } from './testing/iwftTest.tsx'

const FLOOR = GRID_HEIGHT - 1

test('paint sand while paused, press play, and it falls and settles at the floor', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // sand is selected by default
  expect(await root.isSelected('sand')).toBe(true)
  await root.paintCell(150, FLOOR - 9)
  await root.verifyCellIs(150, FLOOR - 9, SAND)

  await root.play()

  await root.verifyCellIs(150, FLOOR, SAND)
  await root.verifyCellIs(150, FLOOR - 9, EMPTY)
})

test('painting keeps working once the sim is running', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('dirt')
  await root.play()

  const before = await root.countSpecies(DIRT)
  await root.paintCell(20, 20)

  await expect.poll(() => root.countSpecies(DIRT)).toBeGreaterThan(before)
})

test('a fast drag paints a continuous stroke, not a dot per pointer sample', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Paused, so the stroke stays where it was painted. The whole drag arrives
  // as one pointermove 200 cells from the pointerdown.
  await root.dragPaint({ x: 50, y: 100 }, { x: 250, y: 100 })

  await root.verifyCellIs(50, 100, SAND)
  await root.verifyCellIs(150, 100, SAND)
  await root.verifyCellIs(250, 100, SAND)
})

test('the world canvas renders crisp (no smoothing)', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPixelated()
})

test('a window resize refits the canvas without disturbing the sim', async ({ mountApp, page }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectElement('dirt')
  await root.paintCell(10, 10)
  await root.verifyCellIs(10, 10, DIRT)

  await page.setViewportSize({ width: 900, height: 700 })

  // Same cell, same content: resize recomputes the letterbox fit, nothing else.
  await root.verifyCellIs(10, 10, DIRT)

  // And the refit leaves the pointer→cell mapping right: the cached canvas
  // rect has to have moved with the new viewport, or paint lands elsewhere.
  await root.paintCell(40, 40)
  await root.verifyCellIs(40, 40, DIRT)
})

test('painting stays on target after the page scrolls under the canvas', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.selectElement('dirt')

  // The page is 100dvh, so nothing scrolls until there is something to scroll
  // past. A tall sibling makes the document scrollable; scrolling then moves
  // the canvas on screen *without* resizing it — the case neither the
  // ResizeObserver nor the DPR watcher sees, and the one that would leave a
  // cached bounding rect stale.
  const scrolled = await page.evaluate(async () => {
    const spacer = document.createElement('div')
    spacer.style.height = '2000px'
    document.body.appendChild(spacer)
    window.scrollTo(0, 400)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    return window.scrollY
  })
  expect(scrolled).toBeGreaterThan(0)

  await root.paintCell(10, 10)
  await root.verifyCellIs(10, 10, DIRT)
})
