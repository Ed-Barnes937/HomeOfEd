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
  await root.finishSaving()

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
  await root.finishSaving()
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
  await root.finishSaving()

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
  await root.finishSaving()
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
  for (let i = 0; i < 12; i++) {
    await root.saveBoop()
    await root.finishSaving()
  }

  await root.verifyBoopCount(12)
})

test('closing "My boops" leaves no dialog behind', async ({ mountApp }) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.closeBoops()

  await expect(page.getByRole('dialog')).toHaveCount(0)
})
