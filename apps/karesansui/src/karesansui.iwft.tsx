import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('the karesansui studio page renders sized sand + mech canvases', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
})

test('cycling the ring item advances the readout', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyRingValue(96)
  await root.cycleRing()
  await root.verifyRingValue(120)
})

test('adding cogs grows the dot train; a 4th cog hides the add control', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyCogCount(1)

  await root.addCog()
  await root.verifyCogCount(2)

  await root.addCog()
  await root.addCog()
  await root.verifyCogCount(4)
  await root.verifyAddCogHidden() // train capped at 4 — no add control
  await root.verifyNoCogDot(4) // no 5th dot

  await root.removeCog(0)
  await root.verifyCogCount(3)
})

test('each cog carries its own marble (one pen per cog)', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.addCog()
  await root.addCog()

  // 3 cogs ⇒ the mechanism draws 3 marbles (settles after the repaint).
  await expect.poll(() => root.getMarbleCount()).toBe(3)
})

test('the offset/speed fields reveal a slider whose readout updates', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('offset', 50)
  await root.verifySliderValue('offset', '0.50')

  await root.dragSlider('speed', 80)
  await root.verifySliderValue('speed', 'brisk')
})

test('the clearing-rake item flips its checked state', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyClearingRakeChecked(false)
  await root.toggleClearingRake()
  await root.verifyClearingRakeChecked(true)
})

test('Play advances the draw to completion', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('speed', 100) // brisk ≈1.5s draw — keeps the test quick
  await root.clickPlay()

  await root.verifyProgressAdvancesPast(0)
  await root.verifyCarveCompletes()
})

test('toggling the preview during a draw does not abort it (fix #4)', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickPlay() // default speed — several seconds of runway
  const advanced = await root.verifyProgressAdvancesPast(0)

  await root.togglePreview()

  // The draw must keep advancing past where it was, not reset or stall.
  await root.verifyProgressAdvancesPast(advanced)
})

test('Clear runs without error and re-enables the button afterward', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickClear()
  await root.verifyClearEnabled()
})

test('Save adds a preset and persists it to localStorage', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickSave()

  await root.verifyPresetVisible(0)
  await root.verifyPersistedPresetCount(1)
})

test('loading a preset restores its saved offset', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('offset', 30) // distinctive, off the 0.66 default
  await root.clickSave()

  await root.cycleRing() // change the config away from the saved preset

  await root.loadPreset(0)

  await root.verifySliderValue('offset', '0.30')
})

test('renaming a preset updates its label', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickSave()
  await root.verifyPresetVisible(0)

  await root.renamePreset(0, 'Morning garden')

  await root.verifyPresetName(0, 'Morning garden')
})

test('deleting a preset removes it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickSave()
  await root.verifyPresetVisible(0)

  await root.deletePreset(0)

  await root.verifyPresetAbsent(0)
})

test('Download triggers a karesansui.png download', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyDownloadDownloadsPng()
})

test('the sand canvas is exposed as a labelled image; the mech canvas is hidden', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifySandCanvasLabelled()
  await root.verifyMechCanvasHidden()
})

test('under prefers-reduced-motion, Play lands the finished pattern without animating', async ({
  mountApp,
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Default speed would animate for ~8s; reduced motion completes at once.
  await root.clickPlay()
  await root.verifyCarveCompletes()
})

test('the stage reflows to a sand-hero-first column below 760px', async ({ mountApp, page }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyStageRow() // desktop CT viewport: mechanism companion | sand hero

  await page.setViewportSize({ width: 420, height: 900 })

  await root.verifyStageStacked() // sand hero above the mechanism
})

test('an offset/speed field opens on click and closes on Escape', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openField('offset')
  await root.verifyFieldOpen('offset')

  await root.pressEscape()

  await root.verifyFieldClosed('offset')
})

test('an offset/speed field closes on an outside click', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openField('offset')
  await root.verifyFieldOpen('offset')

  await root.clickOutside()

  await root.verifyFieldClosed('offset')
})

test('the presets menu is absent until a preset exists, then reveals the entry', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyMenuAbsent()

  await root.clickSave()

  await root.verifyPresetVisible(0) // openMenu + entry visible
})

test('the console brightens when a control is focused (D8 keyboard reveal)', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyConsoleRevealsOnFocus()
})

test('each cog marble tracks the draw (per-cog coupling)', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragSlider('speed', 100) // brisk draw keeps the test quick
  const penBefore = await root.getMechPen()

  await root.clickPlay()

  await root.verifyMechPenMovedFrom(penBefore)
})
