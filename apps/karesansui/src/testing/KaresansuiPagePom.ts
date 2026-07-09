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
  private readonly sandCanvas = this.page.getByTestId('sand-canvas')
  private readonly mechCanvas = this.page.getByTestId('mech-canvas')
  private readonly runButton = this.page.getByTestId('run-button')
  private readonly smoothButton = this.page.getByTestId('smooth-button')
  private readonly saveButton = this.page.getByTestId('save-button')
  private readonly exportButton = this.page.getByTestId('export-button')
  private readonly previewToggle = this.page.getByTestId('preview-toggle')

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

  // ---------- sliders (offset / speed / rotations) ----------

  /** Sets a range input's value the way a real drag would: native setter + input/change events. */
  async dragSlider(name: 'offset' | 'speed' | 'rotations', value: number): Promise<void> {
    await this.page.getByTestId(`slider-${name}`).evaluate((el, v) => {
      const input = el as HTMLInputElement
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')
      descriptor?.set?.call(input, String(v))
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }

  async verifySliderValue(name: 'offset' | 'speed' | 'rotations', expected: string): Promise<void> {
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

  async verifyPresetVisible(index: number): Promise<void> {
    await expect(this.page.getByTestId(`preset-${index}`)).toBeVisible()
  }

  async verifyPresetAbsent(index: number): Promise<void> {
    await expect(this.page.getByTestId(`preset-${index}`)).toHaveCount(0)
  }

  /** Clicks the pill's name (load), not its `×` (delete) — the two share a pill container. */
  async loadPreset(index: number): Promise<void> {
    await this.page.getByTestId(`preset-${index}`).locator('button').first().click()
  }

  async deletePreset(index: number): Promise<void> {
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

  // ---------- reflow (desktop 3-col vs. <=900px single-col, sand → mech → rake) ----------

  /** Desktop: mech | sand | rake side by side in one row. */
  async verifyColumnLayout(): Promise<void> {
    const mechBox = await this.mechCanvas.boundingBox()
    const sandBox = await this.sandCanvas.boundingBox()
    const runBox = await this.runButton.boundingBox()
    expect(mechBox).not.toBeNull()
    expect(sandBox).not.toBeNull()
    expect(runBox).not.toBeNull()
    expect(mechBox!.x).toBeLessThan(sandBox!.x)
    expect(sandBox!.x).toBeLessThan(runBox!.x)
    // Roughly the same row, not stacked.
    expect(Math.abs(mechBox!.y - sandBox!.y)).toBeLessThan(80)
  }

  /** Narrow viewport: single column, DOM/visual order sand → mechanism → rake. */
  async verifyStackedLayout(): Promise<void> {
    const sandBox = await this.sandCanvas.boundingBox()
    const mechBox = await this.mechCanvas.boundingBox()
    const runBox = await this.runButton.boundingBox()
    expect(sandBox).not.toBeNull()
    expect(mechBox).not.toBeNull()
    expect(runBox).not.toBeNull()
    expect(sandBox!.y).toBeLessThan(mechBox!.y)
    expect(mechBox!.y).toBeLessThan(runBox!.y)
  }
}
