import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

/** What one preview canvas is showing: how much is painted, and what. */
type PreviewSignature = { painted: number; checksum: number }

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

  /**
   * Under `prefers-reduced-motion: reduce` every preview must show one
   * representative frame: painted (not a blank card) and unchanged when
   * sampled again a few hundred ms later.
   */
  async verifyPreviewsAreStaticAndPainted(): Promise<void> {
    const [before, after] = await this.sampleTwice()
    expect(after).toEqual(before)
  }

  /** Without the preference the rAF loops still run, so a card keeps changing. */
  async verifyPreviewsAnimate(): Promise<void> {
    const [before, after] = await this.sampleTwice()
    expect(after).not.toEqual(before)
  }

  /**
   * A theme toggle recolours the static frame; otherwise a reduce-motion
   * viewer would be left with a preview drawn for the other theme.
   */
  async verifyStaticPreviewsRepaintOnThemeChange(): Promise<void> {
    await this.waitForPaintedPreviews()
    const before = await this.previewSignatures()
    await this.page.getByRole('button', { name: 'Toggle light/dark theme' }).click()
    await expect
      .poll(async () => (await this.previewSignatures()).map((s) => s.checksum))
      .not.toEqual(before.map((s) => s.checksum))
    const repainted = await this.previewSignatures()
    expect(repainted.every((s) => s.painted > 0)).toBe(true)
    // ...and it is one repaint, not the loop starting up.
    await this.page.waitForTimeout(400)
    expect(await this.previewSignatures()).toEqual(repainted)
  }

  /** Every preview, sampled twice far enough apart for a loop to have moved. */
  private async sampleTwice(): Promise<[PreviewSignature[], PreviewSignature[]]> {
    await this.waitForPaintedPreviews()
    const before = await this.previewSignatures()
    await this.page.waitForTimeout(400)
    return [before, await this.previewSignatures()]
  }

  private async waitForPaintedPreviews(): Promise<void> {
    await expect(this.page.locator('canvas[data-kind]')).toHaveCount(8)
    // A still card repaints once when Space Grotesk arrives, so let the font
    // settle before sampling: that repaint is not the animation under test.
    await this.page.evaluate(() => document.fonts.ready.then(() => undefined))
    await expect
      .poll(async () => (await this.previewSignatures()).filter((s) => s.painted > 0).length)
      .toBe(8)
  }

  /**
   * A cheap per-canvas fingerprint of the painted pixels: enough to tell
   * "nothing was drawn" from "drawn", and one frame from the next.
   */
  private previewSignatures(): Promise<PreviewSignature[]> {
    return this.page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-kind]')).map((cv) => {
        const ctx = cv.getContext('2d')
        if (!ctx || cv.width === 0 || cv.height === 0) return { painted: 0, checksum: 0 }
        const { data } = ctx.getImageData(0, 0, cv.width, cv.height)
        let painted = 0
        let checksum = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue
          painted++
          const px = data[i]! + data[i + 1]! * 3 + data[i + 2]! * 7 + data[i + 3]! * 11
          checksum = (checksum * 31 + px * (i + 1)) % 2147483647
        }
        return { painted, checksum }
      }),
    )
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
