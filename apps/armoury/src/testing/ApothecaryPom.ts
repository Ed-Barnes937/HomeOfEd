import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import { BenchPom } from './BenchPom.ts'
import { CloseUpPom } from './ShopPom.ts'

/** What the fake potion stage was asked to draw, by its `data-*` name. */
export interface PotionFacts {
  shape?: string
  neck?: string
  glass?: string
  stopper?: string
  label?: string
  /** Ingredient ids bottom first, comma-separated; empty for an empty bottle. */
  pours?: string
  effect?: string
  blend?: string
}

export class PotionCloseUpPom extends CloseUpPom {
  /** FakePotionCloseUpStage's stand-in for a tap that lands on the bottle. */
  async tapPotion(): Promise<void> {
    await this.page.getByTestId('close-up-potion').click()
  }
}

export class ApothecaryPom extends BenchPom {
  private readonly table = this.page.getByTestId('counter')
  private readonly stage = this.page.getByTestId('stage')
  private readonly tagLine = this.tagName.locator('xpath=following-sibling::p[1]')

  constructor(page: Page) {
    super(page, {
      scene: 'counter',
      nameField: 'Potion name',
      keep: 'Keep this potion',
      share: 'Share a link to this potion',
      picture: 'Save a picture of this potion',
    })
  }

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Pick the bottle up' })).toBeVisible()
    await expect(this.tagName).toBeVisible()
  }

  async verifyPotionName(name: string): Promise<void> {
    await expect(this.tagName).toHaveText(`${name}, rename`)
  }

  async potionName(): Promise<string> {
    return ((await this.tagName.textContent()) ?? '').replace(/, rename$/, '')
  }

  async potionNumber(): Promise<string> {
    return (
      (await this.table
        .getByText(/^No\. \d{4}$/)
        .first()
        .textContent()) ?? ''
    )
  }

  async description(): Promise<string> {
    return (await this.tagLine.textContent()) ?? ''
  }

  async verifyDescription(text: string): Promise<void> {
    await expect(this.tagLine).toHaveText(text)
  }

  async verifyHint(text: string): Promise<void> {
    await expect(this.table.getByText(text, { exact: true })).toBeVisible()
  }

  async verifyStage(expected: PotionFacts): Promise<void> {
    await expect(this.stage).toHaveAttribute('data-item', 'potion')
    for (const [key, value] of Object.entries(expected) as [string, string][]) {
      await expect(this.stage).toHaveAttribute(`data-${key}`, value)
    }
  }

  async stageFact(name: keyof PotionFacts): Promise<string> {
    return (await this.stage.getAttribute(`data-${name}`)) ?? ''
  }

  async openCloseLook(): Promise<PotionCloseUpPom> {
    await this.page.getByRole('button', { name: 'Pick the bottle up' }).click()
    const closeUp = new PotionCloseUpPom(this.page, 'Your potion, up close')
    await closeUp.verifyIsShown()
    return closeUp
  }

  async verifyKept(message: string): Promise<void> {
    await expect(this.page.getByText(message, { exact: true })).toBeAttached()
  }

  async verifyShelfCount(count: number): Promise<void> {
    await expect(
      this.page.getByRole('link', { name: `Your shelf, ${count} potions` }),
    ).toBeVisible()
  }

  async openTab(tab: string): Promise<void> {
    await this.page.getByRole('tab', { name: tab }).click()
  }

  async verifyTabs(tabs: string[]): Promise<void> {
    await expect(this.page.getByRole('tab')).toHaveText(tabs)
  }
}
