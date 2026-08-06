import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { TEST_SEAM_KEY, type SiltTestSeam } from '../features/sim/useSimLoop.ts'

export class SiltPagePom extends BasePage {
  private readonly canvas = this.page.getByTestId('silt-canvas')
  private readonly playToggle = this.page.getByTestId('play-toggle')

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
