import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('saving snapshots the grid under a generated name — no typing required', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.toggleCell('snare', 4)

  await root.openBoops()
  const name = await root.saveBoop()
  expect(name).toBe('Boop 1')

  await root.verifyBoopCount(1)
  await root.verifyBoopName(0, 'Boop 1')
})

test('save, edit the grid, then load the saved boop back — the original is restored', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.setTempoPercent(50)
  await root.verifyTempo(110)

  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()

  // Edit the grid further and change the tempo — none of this touches the
  // saved boop, only the working grid.
  await root.toggleCell('boop', 15)
  await root.setTempoPercent(90)
  await root.verifyCellOn('boop', 15)

  await root.openBoops()
  await root.loadBoop(0)

  await root.verifyCellOn('kick', 0)
  await root.verifyCellOff('boop', 15)
  await root.verifyTempo(110)
})

test('renaming a saved boop is optional', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.openBoops()
  await root.saveBoop()

  await root.renameBoop(0, 'My Beat')
  await root.verifyBoopName(0, 'My Beat')

  const saved = await root.readSavedBoops()
  expect(saved[0]!.name).toBe('My Beat')
})

test('deleting a saved boop sits behind a confirm', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.openBoops()
  await root.saveBoop()
  await root.verifyBoopCount(1)

  await root.openDeleteBoopConfirm(0)
  await root.verifyDeleteBoopConfirmShown('Boop 1')
  await root.keepPlaying()
  await root.verifyBoopCount(1)

  await root.openDeleteBoopConfirm(0)
  await root.clearIt()
  await root.verifyBoopCount(0)

  const saved = await root.readSavedBoops()
  expect(saved).toEqual([])
})

test('there is no cap on the number of saved boops', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  for (let i = 0; i < 12; i++) await root.saveBoop()

  await root.verifyBoopCount(12)
})

test('closing "My boops" leaves no dialog behind', async ({ mountApp }) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.closeBoops()

  await expect(page.getByRole('dialog')).toHaveCount(0)
})

// --- The save form (ticket 32) ---

test('one press saves exactly one boop; the dialog stays open and the field re-prefills', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.openBoops()

  // The form is there from the start, prefilled — saving is one tap, no typing.
  expect(await root.readBoopSaveNameFieldValue()).toBe('Boop 1')

  await root.saveBoop()
  await root.verifyBoopsPanelShown()
  await root.verifyBoopCount(1)
  await root.verifyBoopHighlighted(0)
  // The name in the box is always the name the next save will write — which is
  // what stops a second press duplicating the first.
  expect(await root.readBoopSaveNameFieldValue()).toBe('Boop 2')

  await root.saveBoop()
  await root.verifyBoopCount(2)
  await root.verifyBoopName(1, 'Boop 2')
})

test('hammering Save still writes exactly one boop', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  // Both presses land before React can re-prefill the field, so the re-prefill
  // alone cannot separate them — the duplicate this whole ticket is about.
  await root.doublePressSave()

  await root.verifyBoopCount(1)
  await root.verifyBoopName(0, 'Boop 1')
})

test('Save is blocked only while the name field is empty', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.verifySaveEnabled()

  await root.typeSaveName('')
  await root.verifySaveDisabled()

  await root.typeSaveName('Thunder')
  await root.verifySaveEnabled()
  await root.pressEnterInSaveName()

  await root.verifyBoopCount(1)
  await root.verifyBoopName(0, 'Thunder')
})

test('the prefilled name follows the list, so a delete cannot make it stale', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.saveBoop()
  expect(await root.readBoopSaveNameFieldValue()).toBe('Boop 2')

  // "Boop 1" is free again, so that is what the next save must write — the box
  // has to say so before the press, not after it.
  await root.openDeleteBoopConfirm(0)
  await root.clearIt()
  expect(await root.readBoopSaveNameFieldValue()).toBe('Boop 1')

  await root.saveBoop()
  await root.verifyBoopName(0, 'Boop 1')
})

test('the name field takes focus on desktop, so Enter alone saves', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.verifySaveNameFieldFocused()
})

// --- Sizing (ticket 30) ---

test('a long list scrolls inside the card, with the title still in view', async ({ mountApp }) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  for (let i = 0; i < 15; i++) await root.saveBoop()
  await root.verifyBoopCount(15)

  const viewport = page.viewportSize()!
  const { width, height } = await root.readBoopsCardSize()
  // clamp(352px, 44vw, 560px) — 44vw of the 1280px CT viewport is over the cap.
  expect(Math.round(width)).toBe(560)
  expect(Math.round(height)).toBe(viewport.height - 64)

  await root.verifyBoopsTitleVisible()
  await root.verifyBoopsListIsTheScroller()
})

test('the card is only as tall as its content when there is little to show', async ({ mountApp }) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  const { height } = await root.readBoopsCardSize()

  expect(height).toBeLessThan(page.viewportSize()!.height - 64)
})
