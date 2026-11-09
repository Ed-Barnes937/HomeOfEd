import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { SAVE_KEY } from '../persistence/storage.ts'

export class ShopPom extends BasePage {
  private readonly counter = this.page.getByTestId('counter')
  private readonly stage = this.page.getByTestId('stage')
  private readonly tagName = this.counter.getByRole('heading', { level: 1 })

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
  }): Promise<void> {
    if (expected.kind) await expect(this.stage).toHaveAttribute('data-kind', expected.kind)
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

  async choose(option: string): Promise<void> {
    await this.page.getByRole('radio', { name: option, exact: true }).click()
  }

  async chooseIn(control: string, option: string): Promise<void> {
    await this.page
      .getByRole('radiogroup', { name: control, exact: true })
      .getByRole('radio', { name: option, exact: true })
      .click()
  }

  async verifyGroupSummary(group: string, summary: string): Promise<void> {
    const toggle = this.page
      .getByRole('button', { expanded: true })
      .filter({ has: this.page.getByRole('heading', { name: group, exact: true }) })
    await expect(toggle).toContainText(summary)
  }

  async verifyControls({ shown = [], hidden = [] }: { shown?: string[]; hidden?: string[] }) {
    const control = (name: string) =>
      this.page
        .getByRole('slider', { name, exact: true })
        .or(this.page.getByRole('radiogroup', { name, exact: true }))
    for (const name of shown) await expect(control(name)).toBeVisible()
    for (const name of hidden) await expect(control(name)).toHaveCount(0)
  }

  async openTab(tab: string): Promise<void> {
    await this.page.getByRole('tab', { name: tab }).click()
  }

  async pickUpWand(): Promise<CloseUpPom> {
    await this.page.getByRole('button', { name: 'Give the wand a wave' }).click()
    const closeUp = new CloseUpPom(this.page)
    await closeUp.verifyIsShown()
    return closeUp
  }

  async tryAnother(): Promise<void> {
    await this.page.getByRole('button', { name: 'Try another' }).click()
  }

  async putBack(): Promise<void> {
    await this.page.getByRole('button', { name: 'Put the last one back' }).click()
  }

  async verifyNothingToPutBack(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Put the last one back' })).toHaveCount(0)
  }

  async lock(part: string): Promise<void> {
    await this.page.getByRole('button', { name: `Keep the ${part} when trying another` }).click()
  }

  async rename(name: string): Promise<void> {
    await this.tagName.getByRole('button').click()
    const input = this.counter.getByRole('textbox', { name: 'Wand name' })
    await input.fill(name)
    await input.press('Enter')
  }

  async keep(): Promise<void> {
    await this.page.getByRole('button', { name: 'Keep this wand' }).click()
    await expect(this.page.getByRole('button', { name: 'On your shelf' })).toBeVisible()
  }

  async verifyShelfCount(count: number): Promise<void> {
    await expect(this.page.getByRole('link', { name: `Your shelf, ${count} wands` })).toBeVisible()
  }

  async openShelf(): Promise<ShelfPom> {
    await this.page.getByRole('link', { name: /^Your shelf/ }).click()
    const shelf = new ShelfPom(this.page)
    await shelf.verifyIsShown()
    return shelf
  }

  async share(): Promise<string> {
    await this.page.getByRole('button', { name: 'Share a link to this wand' }).click()
    await expect(this.page.getByRole('button', { name: 'Link copied' })).toBeVisible()
    return this.page.evaluate(() => navigator.clipboard.readText())
  }

  async savePicture(): Promise<string> {
    const download = this.page.waitForEvent('download')
    await this.page.getByRole('button', { name: 'Save a picture of this wand' }).click()
    return (await download).suggestedFilename()
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
  private readonly dialog = this.page.getByRole('dialog', { name: 'Your wand, up close' })
  private readonly stage = this.page.getByTestId('close-up-stage')

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

export class ShelfPom extends BasePage {
  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Your shelf' })).toBeVisible()
  }

  async verifyWands(names: string[]): Promise<void> {
    const boxes = this.page
      .getByRole('listitem')
      .getByRole('button', { expanded: false })
      .or(this.page.getByRole('listitem').getByRole('button', { expanded: true }))
    await expect(boxes).toHaveCount(names.length)
    for (const [i, name] of names.entries()) await expect(boxes.nth(i)).toContainText(name)
  }

  async open(name: string): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(name) }).click()
  }

  async takeOut(name: string): Promise<void> {
    await this.open(name)
    await this.page.getByRole('button', { name: 'Take it out' }).click()
  }

  async rename(name: string, to: string): Promise<void> {
    await this.open(name)
    await this.page.getByRole('button', { name: 'Rename' }).click()
    await this.page.getByRole('textbox', { name: 'New name' }).fill(to)
    await this.page.getByRole('button', { name: 'Save name' }).click()
  }

  async remove(name: string): Promise<void> {
    await this.open(name)
    await this.page.getByRole('button', { name: 'Remove' }).click()
    await this.page.getByRole('button', { name: 'Remove' }).click()
  }

  async backToCounter(): Promise<void> {
    await this.page.getByRole('link', { name: 'Back to the counter' }).first().click()
  }
}
