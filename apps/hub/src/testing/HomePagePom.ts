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

  async verifyWotdLink(): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'WOTD' })).toHaveAttribute(
      'href',
      'https://wotd.homeofed.com',
    )
  }

  async verifyEspyLink(): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'espy' })).toHaveAttribute(
      'href',
      'https://espy.homeofed.com',
    )
  }

  async verifyKaresansuiLink(): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'karesansui' })).toHaveAttribute(
      'href',
      'https://karesansui.homeofed.com',
    )
  }

  async verifyHeigIsComingSoon(): Promise<void> {
    await expect(this.page.getByText('HEIG')).toBeVisible()
    await expect(this.page.getByRole('link', { name: 'HEIG' })).toHaveCount(0)
  }

  async verifyBoopLink(): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'boop' })).toHaveAttribute(
      'href',
      'https://boop.homeofed.com',
    )
    await expect(this.page.getByText('Coming soon')).toHaveCount(0)
  }

  async verifySiltLink(): Promise<void> {
    await expect(this.page.getByRole('link', { name: 'Silt' })).toHaveAttribute(
      'href',
      'https://silt.homeofed.com',
    )
    // HEIG is now the only card still to come.
    await expect(this.page.getByText('SOON')).toHaveCount(1)
  }

  // The pills sit inside the card, so they are part of the link's accessible
  // name — scope to the card first, then look for the exact pill text.
  async verifyCardShowsNewPill(app: string): Promise<void> {
    const card = this.page.getByRole('link', { name: app })
    await expect(card.getByText('New', { exact: true })).toBeVisible()
    await expect(card.getByText('Updated', { exact: true })).toHaveCount(0)
  }

  async verifyCardShowsUpdatedPill(app: string): Promise<void> {
    const card = this.page.getByRole('link', { name: app })
    await expect(card.getByText('Updated', { exact: true })).toBeVisible()
    await expect(card.getByText('New', { exact: true })).toHaveCount(0)
  }

  async verifyNoCardShowsAPill(): Promise<void> {
    await expect(this.page.getByText('New', { exact: true })).toHaveCount(0)
    await expect(this.page.getByText('Updated', { exact: true })).toHaveCount(0)
  }

  // Each app is a gallery card with a live <canvas> preview — one per app.
  async verifyPreviewsRender(): Promise<void> {
    await expect(this.page.locator('canvas')).toHaveCount(8)
  }

  // On a short, narrow phone the bottom-anchored stack can exceed the viewport;
  // the page must scroll so the wordmark stays reachable (not clipped away by
  // the desktop `overflow: hidden`).
  async verifyWordmarkReachableOnNarrowViewport(): Promise<void> {
    await this.page.setViewportSize({ width: 360, height: 480 })
    const overflowY = await this.page
      .locator('[data-home]')
      .evaluate((el) => getComputedStyle(el).overflowY)
    expect(overflowY).not.toBe('hidden')
    const wordmark = this.page.getByRole('heading', { name: 'home of ed' })
    await wordmark.scrollIntoViewIfNeeded()
    await expect(wordmark).toBeInViewport()
  }
}
