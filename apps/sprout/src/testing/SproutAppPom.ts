import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

// One root POM for the whole SPA (fridge's single-POM pattern). All locators
// and expectations live here; the .iwft specs drive the UI only through these
// intent-level methods. Client-side navigation uses the history API (no reload)
// so the mounted router + installed trampoline stay live across screens.
export class SproutAppPom extends BasePage {
  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'sprout' })).toBeVisible()
  }

  /** Client-side navigate to a route (popstate drives the router; no reload). */
  async goto(path: string): Promise<void> {
    await this.page.evaluate((p) => {
      window.history.pushState({}, '', p)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, path)
  }

  async expectText(text: string, timeout = 10_000): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible({ timeout })
  }

  async expectNotText(text: string): Promise<void> {
    await expect(this.page.getByText(text)).toHaveCount(0)
  }

  async clickButton(name: string): Promise<void> {
    await this.page.getByRole('button', { name }).click()
  }

  async clickLink(name: string): Promise<void> {
    await this.page.getByRole('link', { name }).click()
  }

  async fillByLabel(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label, { exact: true }).fill(value)
  }

  async fillByPlaceholder(placeholder: string, value: string): Promise<void> {
    await this.page.getByPlaceholder(placeholder).fill(value)
  }

  // --- parent dashboard ---

  async verifyDashboardShown(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Parent Dashboard' })).toBeVisible({
      timeout: 10_000,
    })
  }

  async verifyChildTab(name: string): Promise<void> {
    await expect(this.page.getByRole('tab', { name })).toBeVisible({ timeout: 10_000 })
  }

  async selectChildTab(name: string): Promise<void> {
    await this.page.getByRole('tab', { name }).click()
  }

  async verifyTabSelected(name: string): Promise<void> {
    await expect(this.page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true', {
      timeout: 10_000,
    })
  }

  // --- flags ---

  async verifyFlagCount(n: number): Promise<void> {
    await expect(this.page.getByTestId('flag-item')).toHaveCount(n, { timeout: 10_000 })
  }

  async markFirstFlagReviewed(): Promise<void> {
    await this.page.getByTestId('mark-reviewed-button').first().click()
  }

  async verifyReviewedCount(n: number): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Reviewed', exact: true })).toHaveCount(n, {
      timeout: 10_000,
    })
  }

  async filterFlagsByChild(displayName: string): Promise<void> {
    await this.page.getByTestId('child-filter').selectOption({ label: displayName })
  }

  // --- settings switches ---

  private switchByLabel(label: string) {
    return this.page.getByRole('switch', { name: label })
  }

  async toggleSwitch(label: string): Promise<void> {
    await this.switchByLabel(label).click()
  }

  async verifySwitchChecked(label: string, checked: boolean): Promise<void> {
    await expect(this.switchByLabel(label)).toHaveAttribute('aria-checked', String(checked))
  }
}
