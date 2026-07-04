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

test('clicking a theme chip flips data-theme, marks it selected, and persists', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectTheme('retro')

  await root.verifyThemeSelected('retro')
  await root.verifyPersistedTheme('retro')
})

test('the space theme switches boids to its signature rocket shape', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectTheme('space')

  await root.verifyThemeSelected('space')
  await root.verifyShapeSelected('Rocket boids')
  await root.verifyPersistedShape('rocket')
})

test('shape buttons toggle aria-pressed and persist', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectShape('Dot boids')

  await root.verifyShapeSelected('Dot boids')
  await root.verifyPersistedShape('dot')
})

test('dragging the cursor slider updates its bipolar readout and the engine', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('cursor attraction', 1.5)

  await root.verifySliderValue('cursor attraction', '+1.50')
  await root.verifyEngineParam('cursor', 1.5)
})

test('dragging the boid-size slider updates its readout and the engine', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('boid size', 2)

  await root.verifySliderValue('boid size', '2.0×')
  await root.verifyEngineParam('size', 2)
})

test('a section header collapses and expands its contents', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifySliderVisible('boids')

  await root.toggleSection('boid options')
  await root.verifySliderHidden('boids')

  await root.toggleSection('boid options')
  await root.verifySliderVisible('boids')
})

test('the cursor-icon picker toggles aria-pressed and persists', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectCursorIcon('Creature cursor icon')

  await root.verifyCursorIconSelected('Creature cursor icon')
  await root.verifyPersistedCursorIcon('creatures')
})

test('the cursor overlay follows the pointer and hides when it leaves', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyOverlayActive(false)

  await root.movePointer(400, 300)
  await root.verifyOverlayActive(true)

  await root.leaveCanvas()
  await root.verifyOverlayActive(false)
})

test('the pull-range field appears with a sign only while the force is on', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyFieldAbsent() // cursor defaults to 0 (off)

  await root.dragSlider('cursor attraction', 1.5)
  await root.verifyFieldSign('attract')

  await root.dragSlider('cursor attraction', -1.5)
  await root.verifyFieldSign('repel')

  await root.dragSlider('cursor attraction', 0)
  await root.verifyFieldAbsent()
})

test('creatures glyph switches berry/cat by sign and vanishes when off', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectCursorIcon('Creature cursor icon')
  await root.verifyGlyphAbsent() // no glyph while cursor is 0

  await root.dragSlider('cursor attraction', 2)
  await root.verifyGlyphVariant('berry')

  await root.dragSlider('cursor attraction', -2)
  await root.verifyGlyphVariant('cat')

  await root.selectCursorIcon('No cursor icon')
  await root.verifyGlyphAbsent()
})

test('prefers-reduced-motion renders a static frame instead of animating', async ({
  mountApp,
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyStaticFrame()
})
