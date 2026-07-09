import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import type { Op } from '../features/doodle/engine/types.ts'
import { DOODLE_SEAM_KEY, type DoodleTestSeam } from '../features/doodle/useDoodle.ts'

/** The one localStorage slot session.ts persists the current drawing to (spec §10). */
const SESSION_KEY = 'espy:doodle:v1'

export class DoodlePagePom extends BasePage {
  private readonly canvas = this.page.getByTestId('doodle-canvas')
  private readonly subtitle = this.page.getByTestId('hint-subtitle')
  private readonly helpButton = this.page.getByRole('button', { name: 'How to play' })
  private readonly tooltip = this.page.getByRole('tooltip')

  async verifyIsShown(): Promise<void> {
    await expect(this.canvas).toBeVisible()
    const box = await this.canvas.boundingBox()
    expect(box?.width).toBeGreaterThan(0)
    expect(box?.height).toBeGreaterThan(0)
  }

  async counts(): Promise<{ fields: number; blots: number; strokes: number; eyes: number }> {
    await this.waitForSeam()
    return this.canvas.evaluate((el, seamKey) => {
      const seam = (el as unknown as Record<string, DoodleTestSeam>)[seamKey]
      // waitForSeam() has already confirmed it's attached before this runs.
      return seam!.counts()
    }, DOODLE_SEAM_KEY)
  }

  async historyDepth(): Promise<number> {
    await this.waitForSeam()
    return this.canvas.evaluate((el, seamKey) => {
      const seam = (el as unknown as Record<string, DoodleTestSeam>)[seamKey]
      // waitForSeam() has already confirmed it's attached before this runs.
      return seam!.historyDepth()
    }, DOODLE_SEAM_KEY)
  }

  /** Freehand stroke: pointerdown at `from`, pointermove(s) toward `to`, pointerup — canvas-relative client coords. */
  async drawStroke(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('doodle canvas has no bounding box')
    const start = { x: box.x + from.x, y: box.y + from.y }
    const end = { x: box.x + to.x, y: box.y + to.y }
    await this.page.mouse.move(start.x, start.y)
    await this.page.mouse.down()
    await this.page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2)
    await this.page.mouse.move(end.x, end.y)
    await this.page.mouse.up()
  }

  /** A tap (pointerdown alone stamps an eye) at a canvas-relative point. */
  async stampEye(x: number, y: number): Promise<void> {
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('doodle canvas has no bounding box')
    await this.page.mouse.click(box.x + x, box.y + y)
  }

  async selectTool(name: string): Promise<void> {
    await this.page.getByRole('button', { name, exact: true }).click()
  }

  async selectNib(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label, exact: true }).click()
  }

  async clickUndo(): Promise<void> {
    await this.page.getByRole('button', { name: 'Undo' }).click()
  }

  async clickNewPage(): Promise<void> {
    await this.page.getByRole('button', { name: 'New page' }).click()
  }

  async clickSave(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save' }).click()
  }

  /** Cmd/Ctrl-Z, the only keyboard shortcut (spec §8) — unlike a click, it still
   * fires once the Undo button is disabled, which is what makes it possible to
   * probe the undo floor (never letting depth drop below the initial field). */
  async pressUndoShortcut(): Promise<void> {
    await this.page.keyboard.press('Control+z')
  }

  async verifyUndoDisabled(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Undo' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  }

  /** The header subtitle is hidden (via container query) on narrow viewports. */
  async verifySubtitleHidden(): Promise<void> {
    await expect(this.subtitle).toBeHidden()
  }

  async verifySubtitleShown(): Promise<void> {
    await expect(this.subtitle).toBeVisible()
  }

  /** The `?` help button only renders when the subtitle is hidden. */
  async verifyHelpHintShown(): Promise<void> {
    await expect(this.helpButton).toBeVisible()
  }

  async verifyHelpHintHidden(): Promise<void> {
    await expect(this.helpButton).toBeHidden()
  }

  /** Click the `?` and confirm its tooltip reveals the hint copy. */
  async openHelpHintAndVerify(snippet: string): Promise<void> {
    await this.helpButton.click()
    await expect(this.tooltip).toBeVisible()
    await expect(this.tooltip).toContainText(snippet)
  }

  /** Reads the localStorage session key a reload would restore from. */
  async readSession(): Promise<Op[] | null> {
    const raw = await this.page.evaluate((key) => window.localStorage.getItem(key), SESSION_KEY)
    return raw ? (JSON.parse(raw) as Op[]) : null
  }

  /** The seam is attached inside the canvas's mount effect once layout/history
   * are ready — poll rather than assume it's already there the instant
   * mount() resolves. */
  private waitForSeam(): Promise<void> {
    return this.canvas.evaluate((el, seamKey) => {
      return new Promise<void>((resolve) => {
        const check = (): void => {
          if ((el as unknown as Record<string, unknown>)[seamKey]) resolve()
          else requestAnimationFrame(check)
        }
        check()
      })
    }, DOODLE_SEAM_KEY)
  }
}
