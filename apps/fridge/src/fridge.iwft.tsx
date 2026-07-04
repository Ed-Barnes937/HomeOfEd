import { test } from './testing/iwftTest.tsx'

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

test('Clear empties the board but keeps its name', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.setNameInput('Keep Me')
  await root.clickClear()
  await root.verifyMagnetCount(0)
  await root.verifyNameInputValue('Keep Me')
})
