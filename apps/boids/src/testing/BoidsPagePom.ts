import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

export class BoidsPagePom extends BasePage {
  private readonly root = this.page.getByTestId('boids-page')

  async verifyIsShown(): Promise<void> {
    await expect(this.root).toBeVisible()
  }
}
