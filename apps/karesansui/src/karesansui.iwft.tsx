import { fullTurns, prettyTurns } from './features/garden/engine/gears.ts'
import { test } from './testing/iwftTest.tsx'

test('the karesansui studio page renders sized sand + mech canvases', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
})

test('selecting a different ring updates the readout and resets rotations', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Move rotations off its default first so the ring change's reset is observable.
  await root.dragSlider('rotations', 5)
  await root.verifySliderValue('rotations', `5 of ${fullTurns(96, [52])}`)

  await root.selectRing(120)

  await root.verifyRingLabel(120)
  const full = fullTurns(120, [52])
  await root.verifySliderValue('rotations', `${prettyTurns(120, [52])} of ${full}`)
})

test('adding a cog updates the train label; a 4th cog maxes out the dock', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.addWheel(30)
  await root.verifyTrainLabel(2)

  await root.addWheel(24)
  await root.verifyTrainLabel(3)

  await root.addWheel(36)
  await root.verifyTrainLabel(4)
  await root.verifyWheelDisabled(45)
  await root.verifyNoTrainChip(4) // no 5th chip — the train stays capped at 4

  await root.removeWheel(0)
  await root.verifyTrainLabel(3)
})

test('dragging offset/speed/rotations sliders updates their readouts', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('offset', 50)
  await root.verifySliderValue('offset', '0.50 r')

  await root.dragSlider('speed', 80)
  await root.verifySliderValue('speed', 'brisk')

  await root.dragSlider('rotations', 7)
  await root.verifySliderValue('rotations', `7 of ${fullTurns(96, [52])}`)
})

test('picking a rake head marks it selected and deselects the others', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectRake('deep')

  await root.verifyRakeSelected('deep')
})

test('Run advances the carve to completion', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('speed', 100) // brisk ≈1.5s carve — keeps the test quick
  await root.clickRun()

  await root.verifyProgressAdvancesPast(0)
  await root.verifyCarveCompletes()
})

test('toggling the preview during a carve does not abort it (fix #4)', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickRun() // default speed — several seconds of runway
  const advanced = await root.verifyProgressAdvancesPast(0)

  await root.togglePreview()

  // The carve must keep advancing past where it was, not reset or stall.
  await root.verifyProgressAdvancesPast(advanced)
})

test('Smooth runs without error and re-enables the button afterward', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickSmooth()
  await root.verifySmoothEnabled()
})

test('Save adds a preset pill and persists it to localStorage', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickSave()

  await root.verifyPresetVisible(0)
  await root.verifyPersistedPresetCount(1)
})

test('loading a preset restores its saved rotations, not a re-derived value (fix #3)', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('rotations', 5) // distinctive — below prettyTurns(96,[52])'s 13
  await root.clickSave()

  await root.selectRing(120) // change the config away from the saved preset

  await root.loadPreset(0)

  // Saved turns (5), not prettyTurns(96,[52]) (13) which the bug re-derived.
  await root.verifySliderValue('rotations', `5 of ${fullTurns(96, [52])}`)
})

test('deleting a preset removes its pill', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickSave()
  await root.verifyPresetVisible(0)

  await root.deletePreset(0)

  await root.verifyPresetAbsent(0)
})

test('Export triggers a karesansui.png download', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyExportDownloadsPng()
})

test('the sand canvas is exposed as a labelled image; the mech canvas is hidden', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifySandCanvasLabelled()
  await root.verifyMechCanvasHidden()
})

test('under prefers-reduced-motion, Run lands the finished pattern without animating', async ({
  mountApp,
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Default speed would animate for ~8s; reduced motion completes at once.
  await root.clickRun()
  await root.verifyCarveCompletes()
})

test('the stage reflows to a sand-hero-first column below 760px', async ({ mountApp, page }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyStageRow() // desktop CT viewport: mechanism companion | sand hero

  await page.setViewportSize({ width: 420, height: 900 })

  await root.verifyStageStacked() // sand hero above the mechanism
})

test('the Tune popover opens on click and closes on Escape, focus back on the button', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openTune()
  await root.verifyTuneOpen()

  await root.pressEscape()

  await root.verifyTuneClosed()
  await root.verifyTuneButtonFocused()
})

test('the Tune popover closes on an outside click', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openTune()
  await root.verifyTuneOpen()

  await root.clickOutside()

  await root.verifyTuneClosed()
})

test('the Saved tray is absent until a preset exists, then reveals the pill', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyTrayAbsent()

  await root.clickSave()

  await root.verifyPresetVisible(0) // openTray + pill visible
})

test('the console brightens when a control is focused (D8 keyboard reveal)', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyConsoleRevealsOnFocus()
})

test('the mechanism pen tracks the carve (Level-2 coupling)', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('speed', 100) // brisk carve keeps the test quick
  const penBefore = await root.getMechPen()

  await root.clickRun()

  await root.verifyMechPenMovedFrom(penBefore)
})
