import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { TEST_SEAM_KEY, type BoidsTestSeam } from '../features/sim/useSimulationLoop.ts'

interface PersistedSettings {
  theme?: string
  shape?: string
  cursorIcon?: string
  params?: Record<string, number>
}

export class BoidsPagePom extends BasePage {
  private readonly canvas = this.page.getByTestId('boids-page')
  private readonly panel = this.page.getByRole('dialog', { name: 'Simulation settings' })
  private readonly fab = this.page.getByRole('button', { name: 'Open settings' })
  private readonly collapseButton = this.page.getByRole('button', { name: 'Collapse settings' })
  private readonly cursorOverlay = this.page.getByTestId('cursor-overlay')
  private readonly cursorField = this.page.getByTestId('cursor-field')
  private readonly cursorGlyph = this.page.getByTestId('cursor-glyph')

  async verifyIsShown(): Promise<void> {
    await expect(this.canvas).toBeVisible()
    const box = await this.canvas.boundingBox()
    expect(box?.width).toBeGreaterThan(0)
    expect(box?.height).toBeGreaterThan(0)
    await expect(this.panel).toBeVisible()
  }

  /** Asserts the flock is actually animating, not a static frame. */
  async verifySimulationAdvances(): Promise<void> {
    const before = await this.getBoidPositions()
    await expect
      .poll(async () => JSON.stringify(await this.getBoidPositions()) !== JSON.stringify(before))
      .toBe(true)
  }

  async verifySliderValue(label: string, expected: string): Promise<void> {
    await expect(this.page.getByTestId(`slider-${label}-value`)).toHaveText(expected)
  }

  async hoverSliderHeading(label: string): Promise<void> {
    await this.page.getByTestId(`slider-${label}-label`).hover()
  }

  /** The heading tooltip is display:none until hover/focus — assert it surfaced with the right gist. */
  async verifyTooltip(label: string, contains: string): Promise<void> {
    const tooltip = this.page.getByTestId(`slider-${label}-tooltip`)
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText(contains)
  }

  async verifyTooltipHidden(label: string): Promise<void> {
    await expect(this.page.getByTestId(`slider-${label}-tooltip`)).toBeHidden()
  }

  /** Confirms the change reached the running engine, not just the readout. */
  async verifyEngineParam(key: string, expected: number): Promise<void> {
    await expect
      .poll(async () => {
        const params = await this.canvas.evaluate((el, seamKey) => {
          const seam = (el as unknown as Record<string, BoidsTestSeam>)[seamKey]
          return seam?.getParams()
        }, TEST_SEAM_KEY)
        return (params as Record<string, number> | undefined)?.[key]
      })
      .toBe(expected)
  }

  /** Sets a range input's value the way a real drag would: native setter + input/change events. */
  async dragSlider(label: string, value: number): Promise<void> {
    await this.page.getByRole('slider', { name: label }).evaluate((el, v) => {
      const input = el as HTMLInputElement
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')
      descriptor?.set?.call(input, String(v))
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }

  async collapsePanel(): Promise<void> {
    await this.collapseButton.click()
  }

  async expandPanel(): Promise<void> {
    await this.fab.click()
  }

  async verifyCollapsed(): Promise<void> {
    await expect(this.panel).toBeHidden()
    await expect(this.fab).toBeVisible()
  }

  async verifyExpanded(): Promise<void> {
    await expect(this.panel).toBeVisible()
    await expect(this.fab).toBeHidden()
  }

  /**
   * Confirms a change was written to the localStorage key a reload would
   * read from. (Playwright CT can't cleanly reload a mounted component —
   * see boids.iwft.tsx; that a fresh load *reads* this key correctly is
   * covered by settings.test.ts's round-trip test.)
   */
  async verifyPersistedParam(key: string, expected: number): Promise<void> {
    await expect
      .poll(async () => (await this.readPersistedSettings())?.params?.[key])
      .toBe(expected)
  }

  async verifyPersistedTheme(expected: string): Promise<void> {
    await expect.poll(async () => (await this.readPersistedSettings())?.theme).toBe(expected)
  }

  async verifyPersistedShape(expected: string): Promise<void> {
    await expect.poll(async () => (await this.readPersistedSettings())?.shape).toBe(expected)
  }

  async selectTheme(name: string): Promise<void> {
    await this.page.getByRole('button', { name, exact: true }).click()
  }

  async verifyThemeSelected(id: string): Promise<void> {
    await expect(this.page.getByRole('button', { name: id, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect
      .poll(() => this.page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe(id)
  }

  async selectShape(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label }).click()
  }

  async verifyShapeSelected(label: string): Promise<void> {
    await expect(this.page.getByRole('button', { name: label })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }

  /** Click a collapsible section header (e.g. "boid options") to toggle it. */
  async toggleSection(title: string): Promise<void> {
    await this.page.getByRole('button', { name: title, exact: true }).click()
  }

  async verifySliderHidden(label: string): Promise<void> {
    await expect(this.page.getByRole('slider', { name: label })).toHaveCount(0)
  }

  async verifySliderVisible(label: string): Promise<void> {
    await expect(this.page.getByRole('slider', { name: label })).toBeVisible()
  }

  async selectCursorIcon(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label }).click()
  }

  async verifyCursorIconSelected(label: string): Promise<void> {
    await expect(this.page.getByRole('button', { name: label })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }

  async verifyPersistedCursorIcon(expected: string): Promise<void> {
    await expect.poll(async () => (await this.readPersistedSettings())?.cursorIcon).toBe(expected)
  }

  /** Fire a pointermove at viewport coords straight at the canvas (bypasses
   * whatever's painted on top — the handler reads clientX/Y itself). */
  async movePointer(clientX: number, clientY: number): Promise<void> {
    await this.canvas.dispatchEvent('pointermove', { clientX, clientY, bubbles: true })
  }

  async leaveCanvas(): Promise<void> {
    await this.canvas.dispatchEvent('pointerleave', { bubbles: true })
  }

  /** The overlay is opacity-hidden (which Playwright still counts as visible),
   * so assert the data-active flag the pointer handler toggles. */
  async verifyOverlayActive(active: boolean): Promise<void> {
    await expect(this.cursorOverlay).toHaveAttribute('data-active', String(active))
  }

  async verifyGlyphVariant(variant: string): Promise<void> {
    await expect(this.cursorGlyph).toHaveAttribute('data-variant', variant)
  }

  async verifyGlyphAbsent(): Promise<void> {
    await expect(this.cursorGlyph).toHaveCount(0)
  }

  /** The canvas hides the OS cursor (`cursor: none`) only while a glyph is drawn. */
  async verifyCanvasCursorHidden(hidden: boolean): Promise<void> {
    await expect(this.canvas).toHaveCSS('cursor', hidden ? 'none' : 'auto')
  }

  async verifyFieldSign(sign: 'attract' | 'repel'): Promise<void> {
    await expect(this.cursorField).toHaveAttribute('data-sign', sign)
  }

  async verifyFieldAbsent(): Promise<void> {
    await expect(this.cursorField).toHaveCount(0)
  }

  /** Positions must NOT change between frames — the reduced-motion static frame. */
  async verifyStaticFrame(): Promise<void> {
    const before = await this.getBoidPositions()
    await this.page.waitForTimeout(150)
    const after = await this.getBoidPositions()
    expect(after).toEqual(before)
  }

  private async readPersistedSettings(): Promise<PersistedSettings | null> {
    const raw = await this.page.evaluate(
      (k: string) => window.localStorage.getItem(k),
      'boids:settings:v1',
    )
    return raw ? (JSON.parse(raw) as PersistedSettings) : null
  }

  private getBoidPositions(): Promise<{ x: number; y: number }[]> {
    return this.canvas.evaluate((el, key) => {
      const seam = (el as unknown as Record<string, BoidsTestSeam>)[key]
      return seam ? seam.getPositions() : []
    }, TEST_SEAM_KEY)
  }
}
