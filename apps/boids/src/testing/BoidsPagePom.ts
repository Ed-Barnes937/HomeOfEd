import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { TEST_SEAM_KEY, type BoidsTestSeam } from '../features/sim/useSimulationLoop.ts'

export class BoidsPagePom extends BasePage {
  private readonly canvas = this.page.getByTestId('boids-page')

  async verifyIsShown(): Promise<void> {
    await expect(this.canvas).toBeVisible()
    const box = await this.canvas.boundingBox()
    expect(box?.width).toBeGreaterThan(0)
    expect(box?.height).toBeGreaterThan(0)
  }

  /** Asserts the flock is actually animating, not a static frame. */
  async verifySimulationAdvances(): Promise<void> {
    const before = await this.getBoidPositions()
    await expect
      .poll(async () => JSON.stringify(await this.getBoidPositions()) !== JSON.stringify(before))
      .toBe(true)
  }

  private getBoidPositions(): Promise<{ x: number; y: number }[]> {
    return this.canvas.evaluate((el, key) => {
      const seam = (el as unknown as Record<string, BoidsTestSeam>)[key]
      return seam ? seam.getPositions() : []
    }, TEST_SEAM_KEY)
  }
}
