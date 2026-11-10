import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Locator, Page } from '@playwright/test'

import { SAVE_KEY } from '../persistence/storage.ts'
import { BenchPom } from './BenchPom.ts'

export { ShelfPom } from './ShelfPom.ts'

export class ShopPom extends BenchPom {
  private readonly counter = this.page.getByTestId('counter')
  private readonly stage = this.page.getByTestId('stage')

  constructor(page: Page) {
    super(page, {
      scene: 'counter',
      nameField: 'Wand name',
      keep: 'Keep this wand',
      share: 'Share a link to this wand',
      picture: 'Save a picture of this wand',
    })
  }

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Give the wand a wave' })).toBeVisible()
    await expect(this.tagName).toBeVisible()
  }

  async verifyWandName(name: string): Promise<void> {
    await expect(this.tagName).toHaveText(`${name}, rename`)
  }

  async wandName(): Promise<string> {
    return ((await this.tagName.textContent()) ?? '').replace(/, rename$/, '')
  }

  async wandNumber(): Promise<string> {
    return (
      (await this.counter
        .getByText(/^No\. \d{4}$/)
        .first()
        .textContent()) ?? ''
    )
  }

  async verifyDescription(text: string): Promise<void> {
    await expect(this.counter.getByText(text)).toBeVisible()
  }

  async verifyStage(expected: {
    wood?: string
    core?: string
    length?: number
    gems?: number
    kind?: string
    stencil?: string
    bark?: string
    gemColour?: string
    gemCut?: string
    crystal?: string
  }): Promise<void> {
    if (expected.bark) await expect(this.stage).toHaveAttribute('data-bark', expected.bark)
    if (expected.gemColour)
      await expect(this.stage).toHaveAttribute('data-gem-colour', expected.gemColour)
    if (expected.gemCut) await expect(this.stage).toHaveAttribute('data-gem-cut', expected.gemCut)
    if (expected.crystal) await expect(this.stage).toHaveAttribute('data-crystal', expected.crystal)
    if (expected.kind) await expect(this.stage).toHaveAttribute('data-kind', expected.kind)
    if (expected.stencil) await expect(this.stage).toHaveAttribute('data-stencil', expected.stencil)
    if (expected.gems !== undefined)
      await expect(this.stage).toHaveAttribute('data-gems', String(expected.gems))
    if (expected.wood) await expect(this.stage).toHaveAttribute('data-wood', expected.wood)
    if (expected.core) await expect(this.stage).toHaveAttribute('data-core', expected.core)
    if (expected.length)
      await expect(this.stage).toHaveAttribute('data-length', String(expected.length))
  }

  async stageCore(): Promise<string> {
    return (await this.stage.getAttribute('data-core')) ?? ''
  }

  async nextBranch(): Promise<void> {
    await this.page.getByRole('button', { name: 'Next branch' }).click()
  }

  async previousBranch(): Promise<void> {
    await this.page.getByRole('button', { name: 'Previous branch' }).click()
  }

  /** The branch the stepper shows, counted from 1, and that the stage drew the same one. */
  async verifyBranch(number: number): Promise<void> {
    await expect(this.page.getByRole('group', { name: 'Which branch', exact: true })).toContainText(
      String(number),
    )
    await expect(this.stage).toHaveAttribute('data-branch', String(number - 1))
  }

  async openTab(tab: string): Promise<void> {
    await this.page.getByRole('tab', { name: tab }).click()
  }

  async pickUpWand(): Promise<CloseUpPom> {
    await this.page.getByRole('button', { name: 'Give the wand a wave' }).click()
    const closeUp = new CloseUpPom(this.page, 'Your wand, up close')
    await closeUp.verifyIsShown()
    return closeUp
  }

  async verifyNothingToPutBack(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Put the last one back' })).toHaveCount(0)
  }

  async verifyShelfCount(count: number): Promise<void> {
    await expect(this.page.getByRole('link', { name: `Your shelf, ${count} wands` })).toBeVisible()
  }

  /** A different visitor opening a link: nothing of their own saved, just the fragment. */
  async openAsNewVisitor(url: string): Promise<void> {
    const { hash } = new URL(url)
    await this.page.evaluate((fragment) => {
      window.location.hash = fragment
    }, hash)
    await this.page.reload()
    await this.page.evaluate((key) => window.localStorage.removeItem(key), SAVE_KEY)
  }

  async reload(): Promise<void> {
    await this.page.reload()
  }

  /** Reloads with these params saved as the wand on the counter, as an older version saved them. */
  async openWithSavedWand(params: Record<string, unknown>): Promise<void> {
    await this.page.reload()
    await this.page.evaluate(([key, saved]) => window.localStorage.setItem(key, saved), [
      SAVE_KEY,
      JSON.stringify({ version: 1, working: { params }, shelf: [] }),
    ] as const)
  }

  async verifyKind(kind: string): Promise<void> {
    await expect(
      this.page
        .getByRole('radiogroup', { name: 'Kind of wand', exact: true })
        .getByRole('radio', { name: kind, exact: true }),
    ).toHaveAttribute('aria-checked', 'true')
  }
}

export class CloseUpPom extends BasePage {
  private readonly dialog: Locator
  private readonly stage = this.page.getByTestId('close-up-stage')

  constructor(page: Page, dialogName: string) {
    super(page)
    this.dialog = page.getByRole('dialog', { name: dialogName })
  }

  async verifyIsShown(): Promise<void> {
    await expect(this.dialog).toBeVisible()
  }

  async verifyIsHidden(): Promise<void> {
    await expect(this.dialog).toBeHidden()
  }

  async verifyWand(name: string): Promise<void> {
    await expect(this.dialog.getByRole('heading', { name })).toBeVisible()
  }

  async verifySpellsCast(count: number): Promise<void> {
    await expect(this.stage).toHaveAttribute('data-casts', String(count))
  }

  /** How many gems the stage was asked to draw. */
  async verifyGems(count: number): Promise<void> {
    await expect(this.stage).toHaveAttribute('data-gems', String(count))
  }

  /** FakeStage's stand-in for a tap that lands on the wand. */
  async tapWand(): Promise<void> {
    await this.page.getByTestId('close-up-wand').click()
  }

  /** FakeStage's stand-in for a tap on the darkened shop around the wand. */
  async tapAway(): Promise<void> {
    await this.page.getByTestId('close-up-away').click()
  }

  async wave(): Promise<void> {
    await this.dialog.getByRole('button', { name: 'Wave it' }).click()
  }

  async putBack(): Promise<void> {
    await this.dialog.getByRole('button', { name: 'Put it back' }).click()
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
  }
}
