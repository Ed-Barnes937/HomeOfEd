import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('shows a back-to-hub link pointing at home of ed', async ({ mountApp, page }) => {
  await mountApp()
  const back = page.getByRole('link', { name: /back to home of ed/i })
  await expect(back).toHaveAttribute('href', 'http://localhost:3000')
})

test('renders the static fridge scene', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyTrayHasThreeTabs()
  await root.verifyDemoBoard()
})

test('tapping a tray tile spawns a magnet labelled A and selects it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyMagnetCount(8)
  await root.tapTile('A')
  await root.verifyMagnetCount(9)
  await root.verifyLastMagnetLabel('A')
  await root.verifySelectionShown()
})

test('spawns from the numbers and shapes tabs too', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.selectTab('1 2 3')
  await root.tapTile('7')
  await root.verifyMagnetCount(9)
  await root.selectTab('Shapes')
  await root.tapTile('½')
  await root.verifyMagnetCount(10)
})

test('scroll wheel rotates the magnet under the pointer', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyWheelRotates(0)
})

test('double-click removes a magnet', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyMagnetCount(8)
  await root.doubleClickMagnet(0)
  await root.verifyMagnetCount(7)
})

test('the selection × removes the selected magnet', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.clickMagnet(0)
  await root.verifySelectionShown()
  await root.clickDelete()
  await root.verifyMagnetCount(7)
})

test('clicking empty surface hides the selection overlay', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.clickMagnet(0)
  await root.verifySelectionShown()
  await root.clickEmptySurface()
  await root.verifyNoSelection()
})

test('the finish swatch flips the door finish', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyDoorFinish('mint') // default
  await root.selectFinish('White')
  await root.verifyDoorFinish('white')
})

test('the kitchen-light swatch flips the light overlay', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyLightWall('warm') // default
  await root.selectLight('Night')
  await root.verifyLightWall('dark')
})

test('dragging a magnet onto a neighbour bumps the neighbour', async ({ mountApp }) => {
  const { root } = await mountApp()
  // Drag the first HELLO letter onto the second — the neighbour slides aside.
  await root.verifyDragBumps(0, 1)
})

test('typing a name and clicking Save adds a chip and marks it active', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.setNameInput('Party Fridge')
  await root.clickSave()
  await root.verifyChip('Party Fridge')
  await root.verifyActiveChip('Party Fridge')
})

test('saving with an empty name falls back to "Fridge N"', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.clickSave()
  await root.verifyChip('Fridge 1')
})

test('every mutation persists the current board, finish, and light for a reload to restore', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.tapTile('A')
  await root.selectFinish('White')
  await root.selectLight('Night')
  await root.verifyPersistedMagnetCount(9)
  await root.verifyPersistedFinish('white')
  await root.verifyPersistedWall('dark')
})

test('the × on a chip deletes it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.setNameInput('Temp')
  await root.clickSave()
  await root.verifyChip('Temp')
  await root.deleteChip('Temp')
  await root.verifyNoChip('Temp')
})

test('clicking a chip loads its board, finish, and name', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.clickClear()
  await root.verifyMagnetCount(0) // wait for the sweep to finish before saving
  await root.setNameInput('Empty One')
  await root.clickSave()
  await root.clickNew()
  await root.tapTile('Z')
  await root.verifyMagnetCount(1)

  await root.loadChip('Empty One')

  await root.verifyMagnetCount(0)
  await root.verifyNameInputValue('Empty One')
})

test('New starts an empty, unnamed board', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.setNameInput('Something')
  await root.clickNew()
  await root.verifyMagnetCount(0)
  await root.verifyNameInputValue('')
})

test('Empty the fridge sweeps the board clear but keeps its name', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.setNameInput('Keep Me')
  await root.clickClear()
  await root.verifyMagnetCount(0) // the sweep animates out, then empties the board
  await root.verifyNameInputValue('Keep Me')
})

test('Empty the fridge is disabled once the board is empty', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyClearEnabled() // demo board has magnets
  await root.clickClear()
  await root.verifyMagnetCount(0)
  await root.verifyClearDisabled() // a no-op sweep on an empty board would look broken
})

test('the board locks (no save/share/add/load) while the sweep runs', async ({ mountApp }) => {
  const { root } = await mountApp()
  // A saved chip to prove chip-load locks too.
  await root.setNameInput('Snapshot')
  await root.clickSave()
  await root.verifyChip('Snapshot')

  await root.clickClear() // start the sweep
  await root.verifyLockedWhileSweeping() // Save/Share/tile/chip all disabled mid-sweep
  await root.verifyMagnetCount(0) // sweep finishes and empties the board
})

test('Empty the fridge skips the sweep and empties instantly under reduced motion', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.emulateReducedMotion()
  await root.verifyMagnetCount(8)
  await root.clickClear()
  await root.verifyMagnetCount(0) // no sweep animation — cleared in place
})

test('mobile: slim icon bar + FAB add-overlay replace the inline tray', async ({
  mountApp,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 }) // phone, portrait
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyMobileBarShown()
  await root.verifyNoInlineTray() // (a) no inline tray on mobile
  await root.verifyMagnetCount(8)

  await root.openAddOverlay() // (b) FAB opens the add overlay
  await root.verifyAddOverlayShown()
  await root.tapTile('A') // (c) adding from the overlay lands on the board
  await root.verifyMagnetCount(9)
  await root.closeAddOverlay()

  await root.verifyNoHorizontalOverflow() // (d) no sideways scroll
})

test('mobile: a portrait-tablet width still gets the compact chrome, not desktop', async ({
  mountApp,
  page,
}) => {
  await page.setViewportSize({ width: 810, height: 1080 }) // portrait tablet
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyMobileBarShown() // compact chrome, not the desktop TopBar
  await root.verifyNoInlineTray()
  await root.verifyNoHorizontalOverflow() // desktop chrome would overflow here
})

test('mobile: the overflow menu saved list flows below its caption without overlap', async ({
  mountApp,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { root } = await mountApp()
  await root.openMobileMenu()
  await root.verifyMobileMenuLaysOutCleanly()
})
