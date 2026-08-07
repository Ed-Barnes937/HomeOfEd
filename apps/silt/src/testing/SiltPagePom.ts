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

  // ---- scenes popover (spec §9) ----------------------------------------

  async openScenes(): Promise<void> {
    await this.page.getByTestId('scenes-button').click()
    await expect(this.page.getByTestId('scenes-popover')).toBeVisible()
  }

  async closeScenes(): Promise<void> {
    await this.page.getByTestId('scenes-close').click()
    await expect(this.page.getByTestId('scenes-popover')).toHaveCount(0)
  }

  async saveScene(): Promise<void> {
    await this.page.getByTestId('scene-save').click()
  }

  async loadScene(name: string): Promise<void> {
    await this.page.getByTestId(`scene-load-${name}`).click()
  }

  async duplicateScene(name: string): Promise<void> {
    await this.page.getByTestId(`scene-duplicate-${name}`).click()
  }

  async verifySceneRow(name: string): Promise<void> {
    await expect(this.page.getByTestId(`scene-row-${name}`)).toBeVisible()
  }

  async verifyNoSceneRow(name: string): Promise<void> {
    await expect(this.page.getByTestId(`scene-row-${name}`)).toHaveCount(0)
  }

  async sceneRowCount(): Promise<number> {
    return this.page.getByTestId('scenes-popover').getByRole('listitem').count()
  }

  /** When the row says it was last saved. */
  async sceneUpdatedAt(name: string): Promise<string> {
    return this.statusText(`scene-updated-${name}`)
  }

  async verifySceneThumbnail(name: string): Promise<void> {
    const src = await this.page
      .getByTestId(`scene-row-${name}`)
      .getByTestId('scene-thumb')
      .getAttribute('src')
    expect(src).toMatch(/^data:image\/png;base64,/)
  }

  async renameScene(from: string, to: string): Promise<void> {
    const field = this.page.getByTestId(`scene-name-${from}`)
    await field.fill(to)
    await field.press('Enter')
  }

  /** Types into a rename field and leaves it focused — for testing what the hotkeys do mid-edit. */
  async typeInSceneName(from: string, text: string): Promise<void> {
    const field = this.page.getByTestId(`scene-name-${from}`)
    await field.fill(text)
  }

  /** One click arms, the second deletes — the required confirm (spec §9). */
  async deleteScene(name: string): Promise<void> {
    const button = this.page.getByTestId(`scene-delete-${name}`)
    await button.click()
    await expect(button).toHaveText(/sure/)
    await button.click()
  }

  async sceneStatus(): Promise<string> {
    return this.statusText('scenes-status')
  }

  /** The scene name shown in the header. */
  async headerSceneName(): Promise<string> {
    return this.statusText('scene-name')
  }

  async statusText(testId: string): Promise<string> {
    return (await this.page.getByTestId(testId).textContent()) ?? ''
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key)
  }

  /** Paints one cell via real pointer events dispatched at the canvas — no seam bypass. */
  async paintCell(x: number, y: number): Promise<void> {
    const { clientX, clientY } = await this.canvasClientPoint(x, y)
    await this.canvas.dispatchEvent('pointerdown', { clientX, clientY, bubbles: true })
    await this.canvas.dispatchEvent('pointerup', { clientX, clientY, bubbles: true })
  }

  /** Paints one cell via a real single-finger touch tap (spec §9: one finger paints). */
  async touchPaintCell(x: number, y: number): Promise<void> {
    const { clientX, clientY } = await this.canvasClientPoint(x, y)
    await this.page.touchscreen.tap(clientX, clientY)
  }

  private async canvasClientPoint(x: number, y: number): Promise<{ clientX: number; clientY: number }> {
    const point = await this.gridToCanvasPoint(x, y)
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('silt-canvas has no bounding box')
    return { clientX: box.x + point.x, clientY: box.y + point.y }
  }

  /** Mobile bottom bar (spec §9, design brief §02): step drops off. */
  async verifyStepHidden(): Promise<void> {
    await expect(this.stepButton).toBeHidden()
  }

  /** Erase belongs at the tail of the same scrollable palette row, not on a separate row. */
  async verifyEraseIsLastInPaletteRow(): Promise<void> {
    const swatchBoxes = await this.page.getByTestId(/^element-/).all()
    const eraseBox = await this.eraseButton.boundingBox()
    if (!eraseBox) throw new Error('erase-tool has no bounding box')
    for (const swatch of swatchBoxes) {
      const box = await swatch.boundingBox()
      if (!box) throw new Error('palette swatch has no bounding box')
      expect(eraseBox.x).toBeGreaterThan(box.x)
    }
  }

  /** Touch targets must be 44–48px on a side (spec §9). */
  async verifyTouchTargetSize(testId: string): Promise<void> {
    const box = await this.page.getByTestId(testId).boundingBox()
    if (!box) throw new Error(`${testId} has no bounding box`)
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
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
