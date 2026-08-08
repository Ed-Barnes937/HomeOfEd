import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('arrow keys move the focused cell around the grid', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.focusCell('kick', 0)
  await root.pressArrowKey('ArrowRight')
  await root.verifyCellFocused('kick', 1)

  await root.pressArrowKey('ArrowDown')
  await root.verifyCellFocused('snare', 1)

  await root.pressArrowKey('ArrowLeft')
  await root.verifyCellFocused('snare', 0)

  await root.pressArrowKey('ArrowUp')
  await root.verifyCellFocused('kick', 0)
})

test('arrow keys stop at the grid edges rather than wrapping', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.focusCell('kick', 0)
  await root.pressArrowKey('ArrowUp')
  await root.verifyCellFocused('kick', 0)
  await root.pressArrowKey('ArrowLeft')
  await root.verifyCellFocused('kick', 0)
})

test('Enter toggles the focused cell on and off', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCellWithKeyboard('marimba', 3)
  await root.verifyCellOn('marimba', 3)

  await root.toggleCellWithKeyboard('marimba', 3)
  await root.verifyCellOff('marimba', 3)
})

test('Backspace removes the focused cell, and does nothing to an already-off one', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.focusCell('hat', 6)
  await root.pressBackspace()
  await root.verifyCellOff('hat', 6)

  await root.toggleCellWithKeyboard('hat', 6)
  await root.verifyCellOn('hat', 6)

  await root.focusCell('hat', 6)
  await root.pressBackspace()
  await root.verifyCellOff('hat', 6)
})

test('spacebar toggles play from a random focus target on the page', async ({ mountApp, page }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPaused()

  // Focused on a real button, not the grid — the listener has to be global,
  // not just attached to the grid, and it must not re-trigger this button's
  // own click (which would open the clear-grid confirm instead of playing).
  await root.focusClearGridButton()
  await root.pressSpaceKey()

  await root.verifyPlaying()
  await expect(page.getByText('Clear the whole grid?')).toHaveCount(0)

  await root.pressSpaceKey()
  await root.verifyPaused()
})

test('space in the boop name field types a space instead of toggling play', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPaused()

  // The field is focused the moment the dialog opens (desktop autofocus).
  await root.openBoops()
  const name = await root.readBoopSaveNameFieldValue()
  await root.pressSpaceKey()

  await root.verifyPaused()
  expect(await root.readBoopSaveNameFieldValue()).toBe(`${name} `)
})
