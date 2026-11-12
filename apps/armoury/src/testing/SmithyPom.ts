import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import { BenchPom } from './BenchPom.ts'
import { CloseUpPom } from './ShopPom.ts'

/** What the fake sword stage was asked to draw, by its `data-*` name in camel case. */
export interface SwordFacts {
  family?: string
  lengthMm?: string
  guard?: string
  grip?: string
  pommel?: string
  runes?: string
  gems?: string
  steel?: string
  tip?: string
}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

export class SmithyPom extends BenchPom {
  private readonly anvil = this.page.getByTestId('counter')
  private readonly stage = this.page.getByTestId('stage')
  private readonly tagLine = this.tagName.locator('xpath=following-sibling::p[1]')

  constructor(page: Page) {
    super(page, {
      scene: 'counter',
      nameField: 'Sword name',
      keep: 'Keep this sword',
      share: 'Share a link to this sword',
      picture: 'Save a picture of this sword',
    })
  }

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Pick the sword up' })).toBeVisible()
    await expect(this.tagName).toBeVisible()
  }

  async verifySwordName(name: string): Promise<void> {
    await expect(this.tagName).toHaveText(`${name}, rename`)
  }

  async swordName(): Promise<string> {
    return ((await this.tagName.textContent()) ?? '').replace(/, rename$/, '')
  }

  async swordNumber(): Promise<string> {
    return (
      (await this.anvil
        .getByText(/^No\. \d{4}$/)
        .first()
        .textContent()) ?? ''
    )
  }

  /** The tag line under the sword's name. */
  async description(): Promise<string> {
    return (await this.tagLine.textContent()) ?? ''
  }

  async verifyDescription(text: string): Promise<void> {
    await expect(this.tagLine).toContainText(text)
  }

  async verifyStage(expected: SwordFacts): Promise<void> {
    await expect(this.stage).toHaveAttribute('data-item', 'sword')
    for (const [key, value] of Object.entries(expected) as [string, string][]) {
      await expect(this.stage).toHaveAttribute(`data-${kebab(key)}`, value)
    }
  }

  async stageFact(name: string): Promise<string> {
    return (await this.stage.getAttribute(`data-${name}`)) ?? ''
  }

  async setSlider(name: string, value: number): Promise<void> {
    await this.page.getByRole('slider', { name, exact: true }).fill(String(value))
  }

  async chooseKind(kind: string): Promise<void> {
    await this.chooseIn('Kind of sword', kind)
  }

  async verifyKind(kind: string): Promise<void> {
    await expect(
      this.page
        .getByRole('radiogroup', { name: 'Kind of sword', exact: true })
        .getByRole('radio', { name: kind, exact: true }),
    ).toHaveAttribute('aria-checked', 'true')
  }

  async openCloseLook(): Promise<CloseUpPom> {
    await this.page.getByRole('button', { name: 'Pick the sword up' }).click()
    const closeUp = new CloseUpPom(this.page, 'Your sword, up close')
    await closeUp.verifyIsShown()
    return closeUp
  }

  async verifyKept(message: string): Promise<void> {
    await expect(this.page.getByText(message, { exact: true })).toBeAttached()
  }

  async verifyShelfCount(count: number): Promise<void> {
    await expect(this.page.getByRole('link', { name: `Your shelf, ${count} swords` })).toBeVisible()
  }

  async openTab(tab: string): Promise<void> {
    await this.page.getByRole('tab', { name: tab }).click()
  }

  async verifyTabs(tabs: string[]): Promise<void> {
    await expect(this.page.getByRole('tab')).toHaveText(tabs)
  }
}
