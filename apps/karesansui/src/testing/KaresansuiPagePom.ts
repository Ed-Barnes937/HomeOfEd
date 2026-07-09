import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Locator } from '@playwright/test'

import type { RakeId } from '../features/garden/engine/state.ts'
import { RAKE_TEST_SEAM_KEY, type RakeTestSeam } from '../features/garden/useRakeLoop.ts'

const RAKE_IDS: RakeId[] = ['marble', 'wide', 'deep', 'fine']
const STORAGE_KEY = 'karesansui:presets:v1'

/** Whole-page POM for the studio — every control + the sand canvas' test seam. */
export class KaresansuiPagePom extends BasePage {
  private readonly root = this.page.getByTestId('karesansui-page')
  private readonly console = this.page.getByTestId('console')
  private readonly sandCanvas = this.page.getByTestId('sand-canvas')
  private readonly mechCanvas = this.page.getByTestId('mech-canvas')
  private readonly runButton = this.page.getByTestId('run-button')
  private readonly smoothButton = this.page.getByTestId('smooth-button')
  private readonly saveButton = this.page.getByTestId('save-button')
  private readonly exportButton = this.page.getByTestId('export-button')
  private readonly previewToggle = this.page.getByTestId('preview-toggle')
  private readonly tuneButton = this.page.getByTestId('tune-button')
  private readonly tunePanel = this.page.getByTestId('tune-panel')
  private readonly trayToggle = this.page.getByTestId('tray-toggle')

  async verifyIsShown(): Promise<void> {
    await expect(this.root).toBeVisible()
    await this.verifySized(this.sandCanvas)
    await this.verifySized(this.mechCanvas)
  }

  private async verifySized(canvas: Locator): Promise<void> {
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box?.width).toBeGreaterThan(0)
    expect(box?.height).toBeGreaterThan(0)
  }

  // ---------- accessibility ----------

  /** The sand output is the app's result — it must carry an image role + label. */
  async verifySandCanvasLabelled(): Promise<void> {
    await expect(this.sandCanvas).toHaveAttribute('role', 'img')
    await expect(this.sandCanvas).toHaveAttribute('aria-label', /sand garden raked from/i)
  }

  /** The mechanism canvas is decorative — hidden from assistive tech. */
  async verifyMechCanvasHidden(): Promise<void> {
    await expect(this.mechCanvas).toHaveAttribute('aria-hidden', 'true')
  }

  // ---------- ring ----------

  async selectRing(teeth: number): Promise<void> {
    await this.page.getByTestId(`ring-${teeth}`).click()
  }

  async verifyRingLabel(teeth: number): Promise<void> {
    await expect(this.page.getByText(`${teeth} teeth`, { exact: true })).toBeVisible()
  }

  // ---------- gear train ----------

  async addWheel(teeth: number): Promise<void> {
    await this.page.getByTestId(`wheel-${teeth}`).click()
  }

  async removeWheel(index: number): Promise<void> {
    await this.page.getByTestId(`train-chip-remove-${index}`).click()
  }

  async verifyTrainLabel(cogs: number): Promise<void> {
    const text = cogs === 1 ? '1 cog' : `${cogs} cogs`
    await expect(this.page.getByText(text, { exact: true })).toBeVisible()
  }

  async verifyNoTrainChip(index: number): Promise<void> {
    await expect(this.page.getByTestId(`train-chip-${index}`)).toHaveCount(0)
  }

  /** Wheel dock chips dim to opacity 0.32 and disable once the train is at MAX_GEARS. */
  async verifyWheelDisabled(teeth: number): Promise<void> {
    const wheel = this.page.getByTestId(`wheel-${teeth}`)
    await expect(wheel).toBeDisabled()
    await expect(wheel).toHaveCSS('opacity', '0.32')
  }

  // ---------- tune popover (holds the offset / speed / rotations sliders) ----------

  /** Ensure the Tune popover is open — a real toggle, so only click when closed. */
  async openTune(): Promise<void> {
    if ((await this.tunePanel.count()) === 0) await this.tuneButton.click()
    await expect(this.tunePanel).toBeVisible()
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
  }

  async verifyTuneOpen(): Promise<void> {
    await expect(this.tunePanel).toBeVisible()
    await expect(this.tuneButton).toHaveAttribute('aria-expanded', 'true')
  }

  async verifyTuneClosed(): Promise<void> {
    await expect(this.tunePanel).toHaveCount(0)
    await expect(this.tuneButton).toHaveAttribute('aria-expanded', 'false')
  }

  async verifyTuneButtonFocused(): Promise<void> {
    await expect(this.tuneButton).toBeFocused()
  }

  /** Click somewhere neutral (the wordmark) to dismiss any open popover. */
  async clickOutside(): Promise<void> {
    await this.page.getByText('Karesansui', { exact: true }).click()
  }

  // ---------- sliders (offset / speed / rotations) ----------

  /** Sets a range input's value the way a real drag would: native setter + input/change events. */
  async dragSlider(name: 'offset' | 'speed' | 'rotations', value: number): Promise<void> {
    await this.openTune()
    await this.page.getByTestId(`slider-${name}`).evaluate((el, v) => {
      const input = el as HTMLInputElement
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')
      descriptor?.set?.call(input, String(v))
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }

  async verifySliderValue(name: 'offset' | 'speed' | 'rotations', expected: string): Promise<void> {
    await this.openTune() // an intervening control click may have dismissed the popover
    await expect(this.page.getByTestId(`slider-${name}-value`)).toHaveText(expected)
  }

  // ---------- rake picker ----------

  async selectRake(id: RakeId): Promise<void> {
    await this.page.getByTestId(`rake-${id}`).click()
  }

  async verifyRakeSelected(id: RakeId): Promise<void> {
    for (const other of RAKE_IDS) {
      await expect(this.page.getByTestId(`rake-${other}`)).toHaveAttribute(
        'aria-pressed',
        String(other === id),
      )
    }
  }

  // ---------- preview toggle ----------

  async togglePreview(): Promise<void> {
    await this.previewToggle.click()
  }

  // ---------- run / carve (via the RAKE_TEST_SEAM_KEY seam on the sand canvas) ----------

  async clickRun(): Promise<void> {
    await this.runButton.click()
  }

  async getProgress(): Promise<number> {
    return this.sandCanvas.evaluate((el, key) => {
      const seam = (el as unknown as Record<string, RakeTestSeam>)[key]
      return seam ? seam.getProgress() : 0
    }, RAKE_TEST_SEAM_KEY)
  }

  async isCarved(): Promise<boolean> {
    return this.sandCanvas.evaluate((el, key) => {
      const seam = (el as unknown as Record<string, RakeTestSeam>)[key]
      return seam ? seam.isCarved() : false
    }, RAKE_TEST_SEAM_KEY)
  }

  /** Asserts the carve is actually advancing, not stalled — returns the observed progress. */
  async verifyProgressAdvancesPast(previous: number): Promise<number> {
    await expect.poll(() => this.getProgress()).toBeGreaterThan(previous)
    return this.getProgress()
  }

  async verifyCarveCompletes(): Promise<void> {
    await expect.poll(() => this.isCarved()).toBe(true)
    await expect.poll(() => this.getProgress()).toBeGreaterThanOrEqual(0.99)
  }

  // ---------- smooth ----------

  async clickSmooth(): Promise<void> {
    await this.smoothButton.click()
  }

  async verifySmoothEnabled(): Promise<void> {
    await expect(this.smoothButton).toBeEnabled()
  }

  // ---------- save / load / delete presets ----------

  async clickSave(): Promise<void> {
    await this.saveButton.click()
  }

  /** Expand the Saved tray — a real disclosure, present only once a preset exists. */
  async openTray(): Promise<void> {
    if ((await this.trayToggle.count()) === 0) return
    if ((await this.trayToggle.getAttribute('aria-expanded')) !== 'true') await this.trayToggle.click()
  }

  async verifyTrayAbsent(): Promise<void> {
    await expect(this.trayToggle).toHaveCount(0)
  }

  async verifyPresetVisible(index: number): Promise<void> {
    await this.openTray()
    await expect(this.page.getByTestId(`preset-${index}`)).toBeVisible()
  }

  async verifyPresetAbsent(index: number): Promise<void> {
    await expect(this.page.getByTestId(`preset-${index}`)).toHaveCount(0)
  }

  /** Clicks the pill's name (load), not its `×` (delete) — the two share a pill container. */
  async loadPreset(index: number): Promise<void> {
    await this.openTray()
    await this.page.getByTestId(`preset-${index}`).locator('button').first().click()
  }

  async deletePreset(index: number): Promise<void> {
    await this.openTray()
    await this.page.getByTestId(`preset-delete-${index}`).click()
  }

  /**
   * Confirms a change was written to the localStorage key a reload would read
   * from. (Playwright CT can't cleanly reload a mounted component — see
   * boids' BoidsPagePom; that a fresh load *reads* this key correctly is
   * covered by settings.test.ts's round-trip test.)
   */
  async verifyPersistedPresetCount(expected: number): Promise<void> {
    await expect.poll(async () => (await this.readPersistedPresets()).length).toBe(expected)
  }

  private async readPersistedPresets(): Promise<unknown[]> {
    const raw = await this.page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)
    return raw ? (JSON.parse(raw) as unknown[]) : []
  }

  // ---------- export ----------

  async verifyExportDownloadsPng(): Promise<void> {
    const [download] = await Promise.all([this.page.waitForEvent('download'), this.exportButton.click()])
    expect(download.suggestedFilename()).toBe('karesansui.png')
  }

  // ---------- console reveal (D8: brightens on hover AND keyboard focus) ----------

  /** Tabbing to a console control lights the whole console (focus-within → opacity 1). */
  async verifyConsoleRevealsOnFocus(): Promise<void> {
    await this.tuneButton.focus()
    await expect(this.console).toHaveCSS('opacity', '1')
  }

  // ---------- coupling (the mechanism pen rides the real geom curve) ----------

  /** The mechanism's last-drawn pen point (mech canvas coords), via the seam. */
  async getMechPen(): Promise<[number, number]> {
    return this.sandCanvas.evaluate((el, key) => {
      const seam = (el as unknown as Record<string, RakeTestSeam>)[key]
      return seam ? seam.getMechPen() : [0, 0]
    }, RAKE_TEST_SEAM_KEY)
  }

  /** Asserts the mech pen has moved from `previous` — proof it tracks the carve. */
  async verifyMechPenMovedFrom(previous: [number, number]): Promise<void> {
    await expect
      .poll(async () => {
        const [x, y] = await this.getMechPen()
        return Math.hypot(x - previous[0], y - previous[1])
      })
      .toBeGreaterThan(1)
  }

  // ---------- reflow (stage: mech | sand row on desktop, sand-hero-first when narrow) ----------

  /** Desktop: mechanism companion and sand hero share a row, mech left of sand. */
  async verifyStageRow(): Promise<void> {
    const mechBox = await this.mechCanvas.boundingBox()
    const sandBox = await this.sandCanvas.boundingBox()
    expect(mechBox).not.toBeNull()
    expect(sandBox).not.toBeNull()
    expect(mechBox!.x).toBeLessThan(sandBox!.x)
    // Roughly the same row, not stacked.
    expect(Math.abs(mechBox!.y - sandBox!.y)).toBeLessThan(120)
  }

  /** Narrow viewport: the stage stacks with the sand hero first (above the mechanism). */
  async verifyStageStacked(): Promise<void> {
    const sandBox = await this.sandCanvas.boundingBox()
    const mechBox = await this.mechCanvas.boundingBox()
    expect(sandBox).not.toBeNull()
    expect(mechBox).not.toBeNull()
    expect(sandBox!.y).toBeLessThan(mechBox!.y)
  }
}
