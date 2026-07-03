import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

export class HomePagePom extends BasePage {
  private readonly healthValue = this.page.getByTestId('health-value')
  private readonly statusDot = this.page.locator('[data-status]')

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'home of ed' })).toBeVisible()
    await expect(this.page.getByText('independent little apps, one roof.')).toBeVisible()
  }

  async verifyBoidsLink(): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'boids' })).toHaveAttribute(
      'href',
      'https://boids.homeofed.com',
    )
  }

  async verifyHealthValue(value: string): Promise<void> {
    await expect(this.healthValue).toHaveText(value)
    await expect(this.statusDot).toHaveAttribute('data-status', 'ok')
  }

  /** Generous timeout: React Query retries 3x (~7s) before settling on error. */
  async verifyHealthError(): Promise<void> {
    await expect(this.healthValue).toHaveText('health check failed', { timeout: 15_000 })
    await expect(this.statusDot).toHaveAttribute('data-status', 'error')
  }
}
