import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('saving snapshots the grid under a generated name — no typing required', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.toggleCell('snare', 4)

  await root.openGrooves()
  const name = await root.saveGroove()
  expect(name).toBe('Groove 1')
  await root.finishSaving()

  await root.verifyGrooveCount(1)
  await root.verifyGrooveName(0, 'Groove 1')
})

test('save, edit the grid, then load the saved groove back — the original is restored', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.setTempoPercent(50)
  await root.verifyTempo(110)

  await root.openGrooves()
  await root.saveGroove()
  await root.finishSaving()
  await root.closeGrooves()

  // Edit the grid further and change the tempo — none of this touches the
  // saved groove, only the working grid.
  await root.toggleCell('boop', 15)
  await root.setTempoPercent(90)
  await root.verifyCellOn('boop', 15)

  await root.openGrooves()
  await root.loadGroove(0)

  await root.verifyCellOn('kick', 0)
  await root.verifyCellOff('boop', 15)
  await root.verifyTempo(110)
})

test('renaming a saved groove is optional', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.openGrooves()
  await root.saveGroove()
  await root.finishSaving()

  await root.renameGroove(0, 'My Beat')
  await root.verifyGrooveName(0, 'My Beat')

  const saved = await root.readSavedCreations()
  expect(saved[0]!.name).toBe('My Beat')
})

test('deleting a saved groove sits behind a confirm', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.openGrooves()
  await root.saveGroove()
  await root.finishSaving()
  await root.verifyGrooveCount(1)

  await root.openDeleteGrooveConfirm(0)
  await root.verifyDeleteGrooveConfirmShown('Groove 1')
  await root.keepPlaying()
  await root.verifyGrooveCount(1)

  await root.openDeleteGrooveConfirm(0)
  await root.clearIt()
  await root.verifyGrooveCount(0)

  const saved = await root.readSavedCreations()
  expect(saved).toEqual([])
})

test('there is no cap on the number of saved grooves', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openGrooves()
  for (let i = 0; i < 12; i++) {
    await root.saveGroove()
    await root.finishSaving()
  }

  await root.verifyGrooveCount(12)
})

test('closing "My grooves" leaves no dialog behind', async ({ mountApp }) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()

  await root.openGrooves()
  await root.closeGrooves()

  await expect(page.getByRole('dialog')).toHaveCount(0)
})
