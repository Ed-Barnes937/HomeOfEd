import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { TEST_SEAM_KEY, type SiltTestSeam } from '../features/sim/useSimLoop.ts'

export class SiltPagePom extends BasePage {
  private readonly canvas = this.page.getByTestId('silt-canvas')
  private readonly playToggle = this.page.getByTestId('play-toggle')
  private readonly stepButton = this.page.getByTestId('step')
  private readonly resetButton = this.page.getByTestId('reset')
  private readonly eraseButton = this.page.getByTestId('erase-tool')
  private readonly runPill = this.page.getByTestId('run-pill')
  private readonly firstVisitHint = this.page.getByTestId('first-visit-hint')

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByText('SILT')).toBeVisible()
    await expect(this.canvas).toBeVisible()
  }

  async selectElement(name: string): Promise<void> {
    await this.page.getByTestId(`element-${name}`).click()
  }

  async isSelected(name: string): Promise<boolean> {
    const pressed = await this.page.getByTestId(`element-${name}`).getAttribute('aria-pressed')
    return pressed === 'true'
  }

  async selectBrush(index: number): Promise<void> {
    await this.page.getByTestId(`brush-${index}`).click()
  }

  async isBrushSelected(index: number): Promise<boolean> {
    const pressed = await this.page.getByTestId(`brush-${index}`).getAttribute('aria-pressed')
    return pressed === 'true'
  }

  async selectErase(): Promise<void> {
    await this.eraseButton.click()
  }

  async isEraseSelected(): Promise<boolean> {
    const pressed = await this.eraseButton.getAttribute('aria-pressed')
    return pressed === 'true'
  }

  async enterSpawnerMode(): Promise<void> {
    await this.page.getByTestId('mode-spawner').click()
  }

  async enterPaintMode(): Promise<void> {
    await this.page.getByTestId('mode-paint').click()
  }

  async isSpawnerModeSelected(): Promise<boolean> {
    const pressed = await this.page.getByTestId('mode-spawner').getAttribute('aria-pressed')
    return pressed === 'true'
  }

  /** Clicks a grid cell — in spawner mode this places or removes a spawner (spec §7). */
  async clickCell(x: number, y: number): Promise<void> {
    await this.paintCell(x, y)
  }

  async verifySpawnerAt(x: number, y: number): Promise<void> {
    await expect(this.page.getByTestId(`spawner-${x}-${y}`)).toBeVisible()
  }

  async verifyNoSpawnerAt(x: number, y: number): Promise<void> {
    await expect(this.page.getByTestId(`spawner-${x}-${y}`)).toHaveCount(0)
  }

  async spawnerCount(): Promise<string> {
    return this.statusText('status-spawners')
  }

  async modeText(): Promise<string> {
    return this.statusText('status-mode')
  }

  async step(): Promise<void> {
    await this.stepButton.click()
  }

  /** Clicks reset once (arms it) without confirming. */
  async clickReset(): Promise<void> {
    await this.resetButton.click()
  }

  /** Clicks reset twice — the required confirm (spec §3). */
  async confirmReset(): Promise<void> {
    await this.resetButton.click()
    await this.resetButton.click()
  }

  async isResetArmed(): Promise<boolean> {
    return (await this.resetButton.textContent())?.includes('confirm') ?? false
  }

  async verifyRunning(): Promise<void> {
    await expect(this.runPill).toHaveText(/running/)
  }

  async verifyPaused(): Promise<void> {
    await expect(this.runPill).toHaveText(/paused/)
  }

  async verifyFirstVisitHintVisible(): Promise<void> {
    await expect(this.firstVisitHint).toBeVisible()
  }

  async verifyFirstVisitHintGone(): Promise<void> {
    await expect(this.firstVisitHint).toHaveCount(0)
  }

  async statusText(testId: string): Promise<string> {
    return (await this.page.getByTestId(testId).textContent()) ?? ''
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key)
  }

  /** Paints one cell via real pointer events dispatched at the canvas — no seam bypass. */
  async paintCell(x: number, y: number): Promise<void> {
    const point = await this.gridToCanvasPoint(x, y)
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('silt-canvas has no bounding box')
    const clientX = box.x + point.x
    const clientY = box.y + point.y
    await this.canvas.dispatchEvent('pointerdown', { clientX, clientY, bubbles: true })
    await this.canvas.dispatchEvent('pointerup', { clientX, clientY, bubbles: true })
  }

  async play(): Promise<void> {
    await this.playToggle.click()
  }

  async speciesAt(x: number, y: number): Promise<number> {
    return this.canvas.evaluate(
      (el, { x, y, key }) => {
        const seam = (el as unknown as Record<string, SiltTestSeam>)[key]!
        return seam.speciesAt(x, y)
      },
      { x, y, key: TEST_SEAM_KEY },
    )
  }

  async countSpecies(species: number): Promise<number> {
    return this.canvas.evaluate(
      (el, { species, key }) => {
        const seam = (el as unknown as Record<string, SiltTestSeam>)[key]!
        return seam.countSpecies(species)
      },
      { species, key: TEST_SEAM_KEY },
    )
  }

  async verifyCellIs(x: number, y: number, species: number): Promise<void> {
    await expect.poll(() => this.speciesAt(x, y)).toBe(species)
  }

  async verifyPixelated(): Promise<void> {
    const value = await this.canvas.evaluate((el) => getComputedStyle(el).imageRendering)
    expect(value).toBe('pixelated')
  }

  private async gridToCanvasPoint(x: number, y: number): Promise<{ x: number; y: number }> {
    return this.canvas.evaluate(
      (el, { x, y, key }) => {
        const seam = (el as unknown as Record<string, SiltTestSeam>)[key]!
        return seam.gridToCanvasPoint(x, y)
      },
      { x, y, key: TEST_SEAM_KEY },
    )
  }
}
