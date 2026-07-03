import { test } from './testing/iwftTest.tsx'

test('the boids page renders a sized, animating canvas', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifySimulationAdvances()
})

test('dragging a slider updates its readout and the running simulation', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('speed', 4.2)

  await root.verifySliderValue('speed', '4.2')
  await root.verifyEngineParam('speed', 4.2)
})

test('collapsing the panel shows the FAB, which restores it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyExpanded()

  await root.collapsePanel()
  await root.verifyCollapsed()

  await root.expandPanel()
  await root.verifyExpanded()
})

test('a slider change is persisted for the next reload to restore', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('vision', 100)
  await root.verifySliderValue('vision', '100px')
  await root.verifyPersistedParam('vision', 100)
})
