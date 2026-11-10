import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Locator, Page } from '@playwright/test'

import { ShelfPom } from './ShelfPom.ts'

/** The words a shop's page objects find its controls by. */
export interface BenchCopy {
  /** The test id of the scene that holds the item and its tag. */
  scene: string
  nameField: string
  keep: string
  share: string
  picture: string
}

/** What every shop has: the controls, Try another, the tag, Keep, Share and Picture. */
export abstract class BenchPom extends BasePage {
  protected readonly copy: BenchCopy
  protected readonly tagName: Locator

  constructor(page: Page, copy: BenchCopy) {
    super(page)
    this.copy = copy
    this.tagName = page.getByTestId(copy.scene).getByRole('heading', { level: 1 })
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

  async verifyOptions(control: string, options: string[]): Promise<void> {
    await expect(
      this.page.getByRole('radiogroup', { name: control, exact: true }).getByRole('radio'),
    ).toHaveText(options)
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
        .or(this.page.getByRole('group', { name, exact: true }))
    for (const name of shown) await expect(control(name)).toBeVisible()
    for (const name of hidden) await expect(control(name)).toHaveCount(0)
  }

  async tryAnother(): Promise<void> {
    await this.page.getByRole('button', { name: 'Try another' }).click()
  }

  async putBack(): Promise<void> {
    await this.page.getByRole('button', { name: 'Put the last one back' }).click()
  }

  async lock(part: string): Promise<void> {
    await this.page.getByRole('button', { name: `Keep the ${part} when trying another` }).click()
  }

  async rename(name: string): Promise<void> {
    await this.tagName.getByRole('button').click()
    const input = this.page
      .getByTestId(this.copy.scene)
      .getByRole('textbox', { name: this.copy.nameField })
    await input.fill(name)
    await input.press('Enter')
  }

  async keep(): Promise<void> {
    await this.page.getByRole('button', { name: this.copy.keep }).click()
    await expect(this.page.getByRole('button', { name: 'On your shelf' })).toBeVisible()
  }

  async openShelf(): Promise<ShelfPom> {
    await this.page.getByRole('link', { name: /^Your shelf/ }).click()
    const shelf = new ShelfPom(this.page)
    await shelf.verifyIsShown()
    return shelf
  }

  async share(): Promise<string> {
    await this.page.getByRole('button', { name: this.copy.share }).click()
    await expect(this.page.getByRole('button', { name: 'Link copied' })).toBeVisible()
    return this.page.evaluate(() => navigator.clipboard.readText())
  }

  async savePicture(): Promise<string> {
    const download = this.page.waitForEvent('download')
    await this.page.getByRole('button', { name: this.copy.picture }).click()
    return (await download).suggestedFilename()
  }
}
