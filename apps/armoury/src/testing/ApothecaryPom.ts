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

  private jar(label: string) {
    return this.page.getByRole('button', { name: `Pour in ${label}`, exact: true })
  }

  private readonly bottleList = this.page.getByRole('list', { name: 'In the bottle' })

  async pour(label: string): Promise<void> {
    await this.jar(label).click()
  }

  /** A tap on a jar that says it is disabled: Playwright would wait for it, a finger does not. */
  async tapJar(label: string): Promise<void> {
    await this.jar(label).click({ force: true })
  }

  async lockPours(): Promise<void> {
    await this.page.getByRole('button', { name: 'Keep what goes in when trying another' }).click()
  }

  async takeOut(label: string): Promise<void> {
    await this.bottleList.getByRole('button', { name: `Take out ${label}`, exact: true }).click()
  }

  async emptyBottle(): Promise<void> {
    await this.page.getByRole('button', { name: 'Empty the bottle', exact: true }).click()
  }

  /** The pours bottom first; the list reads like the bottle, empty rows above the top pour. */
  async verifyPours(labels: string[]): Promise<void> {
    await expect(this.bottleList.getByRole('listitem')).toHaveText([
      ...Array<RegExp>(4 - labels.length).fill(/^Empty$/),
      ...[...labels].reverse().map((label) => new RegExp(`^${label}`)),
    ])
  }

  async verifyFull(): Promise<void> {
    await expect(
      this.page.getByText('The bottle is full. Take one out to pour another.'),
    ).toBeVisible()
    for (const jar of await this.page.getByRole('button', { name: /^Pour in / }).all())
      await expect(jar).toHaveAttribute('aria-disabled', 'true')
  }

  async verifyNotFull(): Promise<void> {
    await expect(this.page.getByText('The bottle is full.')).toHaveCount(0)
    await expect(this.page.getByRole('button', { name: /^Pour in / }).first()).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
  }

  async verifyNoEmptyButton(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Empty the bottle' })).toHaveCount(0)
  }

  async verifyAnnouncement(text: string): Promise<void> {
    await expect(this.page.locator('[aria-live="polite"]', { hasText: text })).toHaveText(text)
  }

  async pourWithKeyboard(label: string): Promise<void> {
    const name = `Pour in ${label}`
    for (let presses = 0; presses < 60; presses++) {
      await this.page.keyboard.press('Tab')
      const focused = await this.page.evaluate(() => document.activeElement?.ariaLabel ?? '')
      if (focused === name) {
        await this.page.keyboard.press('Enter')
        return
      }
    }
    throw new Error(`Tab never reached "${name}"`)
  }

  async verifyJarStillFocusable(label: string): Promise<void> {
    const jar = this.jar(label)
    await jar.focus()
    await expect(jar).toBeFocused()
  }

  async verifyAllJarsShown(): Promise<void> {
    await expect(this.page.getByRole('button', { name: /^Pour in / })).toHaveCount(9)
  }

  /** Every jar, pour and the Empty button can be scrolled to inside the tab, which stays in the sheet's own height. */
  async verifyPoursReachableInSheet(sheetTopAtLeast: number): Promise<void> {
    const panel = this.page.getByRole('tabpanel')
    const sheet = (await panel.boundingBox())!
    expect(sheet.y).toBeGreaterThanOrEqual(sheetTopAtLeast)
    const reachable = [
      ...(await this.page.getByRole('button', { name: /^Pour in / }).all()),
      ...(await this.bottleList.getByRole('listitem').all()),
      this.page.getByRole('button', { name: 'Empty the bottle' }),
    ]
    for (const control of reachable) {
      await control.scrollIntoViewIfNeeded()
      const box = (await control.boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(sheet.y - 1)
      expect(box.y + box.height).toBeLessThanOrEqual(sheet.y + sheet.height + 1)
    }
  }
}
