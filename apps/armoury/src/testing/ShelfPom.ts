import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

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
