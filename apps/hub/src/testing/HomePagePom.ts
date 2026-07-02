import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

export class HomePagePom extends BasePage {
  private readonly healthValue = this.page.getByTestId('health-value')

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'home of ed' })).toBeVisible()
  }

  async verifyHealthValue(value: string): Promise<void> {
    await expect(this.healthValue).toHaveText(value)
  }
}
