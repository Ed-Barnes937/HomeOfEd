import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

export class HomePagePom extends BasePage {
  private readonly greetingValue = this.page.getByTestId('greeting-value')
  private readonly statusDot = this.page.locator('[data-status]')

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'starter' })).toBeVisible()
    await expect(this.page.getByText('a stateless app, ready to copy.')).toBeVisible()
  }

  async verifyGreeting(value: string): Promise<void> {
    await expect(this.greetingValue).toHaveText(value)
    await expect(this.statusDot).toHaveAttribute('data-status', 'ok')
  }

  /** Generous timeout: React Query retries 3x (~7s) before settling on error. */
  async verifyGreetingError(): Promise<void> {
    await expect(this.greetingValue).toHaveText('request failed', { timeout: 15_000 })
    await expect(this.statusDot).toHaveAttribute('data-status', 'error')
  }
}
