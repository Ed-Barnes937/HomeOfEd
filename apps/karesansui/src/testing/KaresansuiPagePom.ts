import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Locator } from '@playwright/test'

import { RAKE_TEST_SEAM_KEY, type RakeTestSeam } from '../features/garden/useRakeLoop.ts'

const STORAGE_KEY = 'karesansui:presets:v2'

/** Whole-page POM for the minimal-console studio — every strip control + the sand seam. */
export class KaresansuiPagePom extends BasePage {
  private readonly root = this.page.getByTestId('karesansui-page')
  private readonly console = this.page.getByTestId('console')
  private readonly sandCanvas = this.page.getByTestId('sand-canvas')
  private readonly mechCanvas = this.page.getByTestId('mech-canvas')
  private readonly ringCycle = this.page.getByTestId('ring-cycle')
  private readonly cogAdd = this.page.getByTestId('cog-add')
  private readonly playButton = this.page.getByTestId('play')
  private readonly clearButton = this.page.getByTestId('clear-button')
  private readonly saveButton = this.page.getByTestId('save-button')
  private readonly downloadButton = this.page.getByTestId('download-button')
  private readonly previewCycle = this.page.getByTestId('preview-cycle')
  private readonly rakeCycle = this.page.getByTestId('rake-cycle')
  private readonly presetsMenu = this.page.getByTestId('presets-menu')

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
    await expect(this.sandCanvas).toHaveAttribute('aria-label', /sand garden grooved by/i)
  }

  /** The mechanism canvas is decorative — hidden from assistive tech. */
  async verifyMechCanvasHidden(): Promise<void> {
    await expect(this.mechCanvas).toHaveAttribute('aria-hidden', 'true')
  }

  // ---------- ring (a single item that cycles 96 → 120 → 144) ----------

  async cycleRing(): Promise<void> {
    await this.ringCycle.click()
  }

  async verifyRingValue(teeth: number): Promise<void> {
    await expect(this.ringCycle).toContainText(String(teeth))
  }

  // ---------- gear train (cog dots — each cog is a pen) ----------

  /** The `+` adds a cog (teeth auto-picked); absent once the train is at MAX_GEARS. */
  async addCog(): Promise<void> {
    await this.cogAdd.click()
  }

  /** Click a cog dot to remove it (the last dot is disabled). */
  async removeCog(index: number): Promise<void> {
    await this.page.getByTestId(`cog-dot-${index}`).click()
  }

  async verifyCogCount(count: number): Promise<void> {
    await expect(this.page.locator('[data-testid^="cog-dot-"]')).toHaveCount(count)
  }

  async verifyNoCogDot(index: number): Promise<void> {
    await expect(this.page.getByTestId(`cog-dot-${index}`)).toHaveCount(0)
  }

  /** At MAX_GEARS the `+` disappears (remove a cog to add). */
  async verifyAddCogHidden(): Promise<void> {
    await expect(this.cogAdd).toHaveCount(0)
  }

  // ---------- offset / speed (a value that reveals a hairline slider on click) ----------

  /** Ensure a field's slider popover is open — the field is a real toggle. */
  async openField(name: 'offset' | 'speed'): Promise<void> {
    if ((await this.page.getByTestId(`${name}-slider`).count()) === 0) {
      await this.page.getByTestId(name).click()
    }
    await expect(this.page.getByTestId(`${name}-slider`)).toBeVisible()
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
  }

  async verifyFieldOpen(name: 'offset' | 'speed'): Promise<void> {
    await expect(this.page.getByTestId(`${name}-slider`)).toBeVisible()
    await expect(this.page.getByTestId(name)).toHaveAttribute('aria-expanded', 'true')
  }

  async verifyFieldClosed(name: 'offset' | 'speed'): Promise<void> {
    await expect(this.page.getByTestId(`${name}-slider`)).toHaveCount(0)
    await expect(this.page.getByTestId(name)).toHaveAttribute('aria-expanded', 'false')
  }

  /** Click somewhere neutral (the wordmark) to dismiss any open popover. */
  async clickOutside(): Promise<void> {
    await this.page.getByText('Karesansui', { exact: true }).click()
  }

  /** Sets a range input's value the way a real drag would: native setter + input/change events. */
  async dragSlider(name: 'offset' | 'speed', value: number): Promise<void> {
    await this.openField(name)
    await this.page.getByTestId(`${name}-slider`).evaluate((el, v) => {
      const input = el as HTMLInputElement
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')
      descriptor?.set?.call(input, String(v))
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }

  /** The readout lives on the field button, so it's assertable without opening. */
  async verifySliderValue(name: 'offset' | 'speed', expected: string): Promise<void> {
    await expect(this.page.getByTestId(`${name}-value`)).toHaveText(expected)
  }

  // ---------- preview / clearing-rake (cycle items: on ↔ off, exposed as switches) ----------

  async togglePreview(): Promise<void> {
    await this.previewCycle.click()
  }

  async toggleClearingRake(): Promise<void> {
    await this.rakeCycle.click()
  }

  async verifyClearingRakeChecked(checked: boolean): Promise<void> {
    await expect(this.rakeCycle).toHaveAttribute('aria-checked', String(checked))
  }

  // ---------- play / draw (via the RAKE_TEST_SEAM_KEY seam on the sand canvas) ----------

  async clickPlay(): Promise<void> {
    await this.playButton.click()
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

  /** Asserts the draw is actually advancing, not stalled — returns the observed progress. */
  async verifyProgressAdvancesPast(previous: number): Promise<number> {
    await expect.poll(() => this.getProgress()).toBeGreaterThan(previous)
    return this.getProgress()
  }

  async verifyCarveCompletes(): Promise<void> {
    await expect.poll(() => this.isCarved()).toBe(true)
    await expect.poll(() => this.getProgress()).toBeGreaterThanOrEqual(0.99)
  }

  // ---------- clear ----------

  async clickClear(): Promise<void> {
    await this.clearButton.click()
  }

  async verifyClearEnabled(): Promise<void> {
    await expect(this.clearButton).toBeEnabled()
  }

  // ---------- save / load / rename / delete presets (Presets ▾ menu) ----------

  async clickSave(): Promise<void> {
    await this.saveButton.click()
  }

  /** Open the presets menu — present only once a preset exists. */
  async openMenu(): Promise<void> {
    if ((await this.presetsMenu.count()) === 0) return
    if ((await this.presetsMenu.getAttribute('aria-expanded')) !== 'true') await this.presetsMenu.click()
  }

  async verifyMenuAbsent(): Promise<void> {
    await expect(this.presetsMenu).toHaveCount(0)
  }

  async verifyPresetVisible(index: number): Promise<void> {
    await this.openMenu()
    await expect(this.page.getByTestId(`preset-${index}`)).toBeVisible()
  }

  async verifyPresetAbsent(index: number): Promise<void> {
    await expect(this.page.getByTestId(`preset-${index}`)).toHaveCount(0)
  }

  async verifyPresetName(index: number, name: string): Promise<void> {
    await this.openMenu()
    await expect(this.page.getByTestId(`preset-${index}`).locator('button').first()).toHaveText(name)
  }

  /** Clicks the entry's name (load), not its ✎/× actions. */
  async loadPreset(index: number): Promise<void> {
    await this.openMenu()
    await this.page.getByTestId(`preset-${index}`).locator('button').first().click()
  }

  async renamePreset(index: number, name: string): Promise<void> {
    await this.openMenu()
    await this.page.getByTestId(`preset-rename-${index}`).click()
    const input = this.page.getByTestId(`preset-rename-input-${index}`)
    await input.fill(name)
    await input.press('Enter')
  }

  async deletePreset(index: number): Promise<void> {
    await this.openMenu()
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

  // ---------- download ----------

  async verifyDownloadDownloadsPng(): Promise<void> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.downloadButton.click(),
    ])
    expect(download.suggestedFilename()).toBe('karesansui.png')
  }

  // ---------- console reveal (D8: brightens on hover AND keyboard focus) ----------

  /** Tabbing to a console control lights the whole console (focus-within → opacity 1). */
  async verifyConsoleRevealsOnFocus(): Promise<void> {
    await this.ringCycle.focus()
    await expect(this.console).toHaveCSS('opacity', '1')
  }

  // ---------- coupling (each cog's marble rides its own groove) ----------

  /** The mechanism's first cog marble point (mech canvas coords), via the seam. */
  async getMechPen(): Promise<[number, number]> {
    return this.sandCanvas.evaluate((el, key) => {
      const seam = (el as unknown as Record<string, RakeTestSeam>)[key]
      return seam?.getMarblePens()[0] ?? [0, 0]
    }, RAKE_TEST_SEAM_KEY)
  }

  /** The number of marbles the mechanism last drew (one per cog). */
  async getMarbleCount(): Promise<number> {
    return this.sandCanvas.evaluate((el, key) => {
      const seam = (el as unknown as Record<string, RakeTestSeam>)[key]
      return seam?.getMarblePens().length ?? 0
    }, RAKE_TEST_SEAM_KEY)
  }

  /** Asserts a marble has moved from `previous` — proof it tracks the draw. */
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
