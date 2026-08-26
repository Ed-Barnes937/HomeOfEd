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

  /** A rail group section and one of the swatches inside it (spec §9). */
  async verifyPaletteGroupContains(label: string, name: string): Promise<void> {
    const group = this.page.getByTestId(`palette-group-${label}`)
    await expect(group).toBeVisible()
    await expect(group.getByTestId(`element-${name}`)).toBeVisible()
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

  /** The chrome saying a click or stroke here will take this spawner (spec §7). */
  async verifySpawnerMarkedForRemoval(x: number, y: number): Promise<void> {
    await expect(this.page.getByTestId(`spawner-${x}-${y}`)).toHaveClass(/spawnerRemove/)
  }

  async verifySpawnerNotMarkedForRemoval(x: number, y: number): Promise<void> {
    await expect(this.page.getByTestId(`spawner-${x}-${y}`)).not.toHaveClass(/spawnerRemove/)
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

  /** It stays mounted and transitions out rather than vanishing on the spot. */
  async verifyFirstVisitHintFadingOut(): Promise<void> {
    await expect(this.firstVisitHint).toHaveClass(/Fading/)
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

  /** The row's thumbnail as its PNG data URL — comparable between rows. */
  async sceneThumbnail(name: string): Promise<string> {
    const src = await this.page
      .getByTestId(`scene-row-${name}`)
      .getByTestId('scene-thumb')
      .getAttribute('src')
    expect(src).toMatch(/^data:image\/png;base64,/)
    return src ?? ''
  }

  async verifySceneThumbnail(name: string): Promise<void> {
    await this.sceneThumbnail(name)
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

  /** Drags from one cell to another delivered as a single pointermove — the
   * event pattern of a fast flick, where samples land many cells apart. */
  async dragPaint(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    const start = await this.canvasClientPoint(from.x, from.y)
    const end = await this.canvasClientPoint(to.x, to.y)
    await this.canvas.dispatchEvent('pointerdown', { ...start, bubbles: true })
    await this.canvas.dispatchEvent('pointermove', { ...end, bubbles: true })
    await this.canvas.dispatchEvent('pointerup', { ...end, bubbles: true })
  }

  /** Moves the pointer over a cell without pressing — drives the hover chrome. */
  async hoverCell(x: number, y: number): Promise<void> {
    const { clientX, clientY } = await this.canvasClientPoint(x, y)
    await this.canvas.dispatchEvent('pointermove', { clientX, clientY, bubbles: true })
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

  /** Every paintable swatch the rail is currently rendering. */
  async paletteElementNames(): Promise<string[]> {
    const testIds = await this.page.getByTestId(/^element-/).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-testid') ?? ''),
    )
    return testIds.map((id) => id.replace('element-', ''))
  }

  /**
   * The rail overflows into its own scroller, never into the page: a bottom bar
   * that pushes the document sideways drags the canvas out of view with it.
   */
  async verifyNoHorizontalPageOverflow(): Promise<void> {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  }

  private async boundingBoxOrThrow(testId: string): Promise<{ width: number; height: number }> {
    const box = await this.page.getByTestId(testId).boundingBox()
    if (!box) throw new Error(`${testId} has no bounding box`)
    return box
  }

  /** Touch targets must be at least 44px on a side (spec §9's floor). */
  async verifyTouchTargetSize(testId: string): Promise<void> {
    const box = await this.boundingBoxOrThrow(testId)
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  /** Square icon chips (brush/swatch) are the comfortable 48x48, not just the 44px floor (spec §9). */
  async verifySquareChipSize(testId: string): Promise<void> {
    const box = await this.boundingBoxOrThrow(testId)
    expect(box.width).toBeCloseTo(48, 0)
    expect(box.height).toBeCloseTo(48, 0)
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

  /** Which frame path the mounted app is rendering through. */
  async rendererKind(): Promise<string> {
    return this.canvas.evaluate(
      (el, key) => {
        const seam = (el as unknown as Record<string, SiltTestSeam>)[key]!
        return seam.rendererKind()
      },
      TEST_SEAM_KEY,
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
