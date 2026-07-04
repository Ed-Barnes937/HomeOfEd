import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

export class HomePagePom extends BasePage {
  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'home of ed' })).toBeVisible()
    await expect(this.page.getByText('A quiet corner, full of little ideas')).toBeVisible()
  }

  async verifyBoidsLink(): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'Boids' })).toHaveAttribute(
      'href',
      'https://boids.homeofed.com',
    )
  }

  async verifyFridgeLink(): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'fridge magnets' })).toHaveAttribute(
      'href',
      'https://fridge.homeofed.com',
    )
  }
}
