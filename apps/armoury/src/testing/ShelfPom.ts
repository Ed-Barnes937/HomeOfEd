import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import type { ItemKind } from '../items/item.ts'

const SECTIONS: Record<ItemKind, string> = { wand: 'Wands', sword: 'Swords' }

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

  private items(kind: ItemKind) {
    return this.page
      .getByRole('region', { name: SECTIONS[kind], exact: true })
      .getByRole('listitem')
      .getByRole('button', { expanded: false })
      .or(
        this.page
          .getByRole('region', { name: SECTIONS[kind], exact: true })
          .getByRole('listitem')
          .getByRole('button', { expanded: true }),
      )
  }

  /** The names on one kind's section of the shelf, in order; none means no section at all. */
  async verifyItems(kind: ItemKind, names: string[]): Promise<void> {
    if (names.length === 0) {
      await expect(
        this.page.getByRole('region', { name: SECTIONS[kind], exact: true }),
      ).toHaveCount(0)
      return
    }
    const items = this.items(kind)
    await expect(items).toHaveCount(names.length)
    for (const [i, name] of names.entries()) await expect(items.nth(i)).toContainText(name)
  }

  async itemNames(kind: ItemKind): Promise<string[]> {
    const items = this.items(kind)
    await expect(items.first()).toBeVisible()
    return items.evaluateAll((buttons) =>
      buttons.map((b) => b.querySelector('[data-name]')?.textContent ?? ''),
    )
  }

  /** The short line under the name on its label. */
  async verifyLabel(name: string, line: string | RegExp): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: new RegExp(name) }).locator('[data-line]'),
    ).toHaveText(line)
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
