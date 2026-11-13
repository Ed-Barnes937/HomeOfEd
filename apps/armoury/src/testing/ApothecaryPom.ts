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

  private readonly emptyButton = this.page.getByRole('button', { name: 'Empty the bottle', exact: true })

  /** The sheet's scrolling box is the nearest scrollable ancestor of the pours list. */
  private sheet() {
    return this.bottleList.evaluateHandle((list) => {
      let box: HTMLElement | null = list.parentElement
      while (box && box.scrollHeight <= box.clientHeight) box = box.parentElement
      return box!
    })
  }

  async scrollSheetToBottom(): Promise<void> {
    await (await this.sheet()).evaluate((box) => (box.scrollTop = box.scrollHeight))
  }

  async scrollSheetToTop(): Promise<void> {
    await (await this.sheet()).evaluate((box) => (box.scrollTop = 0))
  }

  /** The button that was tapped leaves the sheet shorter, so staying put means staying at the bottom. */
  async verifySheetStillAtBottom(): Promise<void> {
    const gap = await (await this.sheet()).evaluate(
      (box) => box.scrollHeight - box.clientHeight - box.scrollTop,
    )
    expect(gap).toBeLessThanOrEqual(1)
  }

  async verifySheetScrolled(): Promise<void> {
    expect(await (await this.sheet()).evaluate((box) => box.scrollTop)).toBeGreaterThan(0)
  }

  /** A finger tap on the last pour's "Take out", with the sheet scrolled down to it. */
  async tapLastTakeOut(): Promise<void> {
    await this.bottleList.getByRole('button').last().tap()
  }

  async tapEmptyBottle(): Promise<void> {
    await this.emptyButton.tap()
  }

  /** The newly focused control lies inside the tab body. */
  async verifyFocusedInView(): Promise<void> {
    const panel = (await this.page.getByRole('tabpanel').boundingBox())!
    const box = (await this.page.locator(':focus').boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(panel.y)
    expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height)
  }

  /** The ninth jar lies inside the tab body as it stands, with no scrolling. */
  async verifyAllJarsInView(): Promise<void> {
    const panel = (await this.page.getByRole('tabpanel').boundingBox())!
    const ninth = (await this.page
      .getByRole('button', { name: /^Pour in / })
      .nth(8)
      .boundingBox())!
    expect(ninth.y).toBeGreaterThanOrEqual(panel.y)
    expect(ninth.y + ninth.height).toBeLessThanOrEqual(panel.y + panel.height)
  }

  /** The ninth jar's bottom and the tab body's bottom, for reporting. */
  async ninthJarAndPanelBottoms(): Promise<{ jar: number; panel: number }> {
    const panel = (await this.page.getByRole('tabpanel').boundingBox())!
    const ninth = (await this.page
      .getByRole('button', { name: /^Pour in / })
      .nth(8)
      .boundingBox())!
    return { jar: ninth.y + ninth.height, panel: panel.y + panel.height }
  }

  /** Every jar and take-out button is at least 44 px tall and wide. */
  async verifyHitTargetsAtLeast44(): Promise<void> {
    const targets = [
      ...(await this.page.getByRole('button', { name: /^Pour in / }).all()),
      ...(await this.bottleList.getByRole('button').all()),
    ]
    for (const target of targets) {
      const box = (await target.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
  }

  /** The pours sit in one column, top first, each with the words "Take out". */
  async verifyPoursInOneColumn(): Promise<void> {
    const rows = await this.bottleList.getByRole('listitem').all()
    const boxes = await Promise.all(rows.map((row) => row.boundingBox()))
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.x).toBe(boxes[0]!.x)
      expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y)
    }
    for (const button of await this.bottleList.getByRole('button').all())
      await expect(button).toHaveText('Take out')
  }

  async takeOutWithKeyboard(label: string, key: 'Enter' | 'Space', nth = 0): Promise<void> {
    const button = this.bottleList.getByRole('button', { name: `Take out ${label}`, exact: true })
    await button.nth(nth).focus()
    await this.page.keyboard.press(key)
  }

  async emptyBottleWithKeyboard(): Promise<void> {
    await this.page.getByRole('button', { name: 'Empty the bottle', exact: true }).focus()
    await this.page.keyboard.press('Enter')
  }

  async verifyFocused(name: string): Promise<void> {
    await expect(this.page.getByRole('button', { name, exact: true })).toBeFocused()
  }

  async verifyJarsDescribedByFullMessage(): Promise<void> {
    const message = this.page.getByText('The bottle is full. Take one out to pour another.')
    const id = await message.getAttribute('id')
    expect(id).toBeTruthy()
    for (const jar of await this.page.getByRole('button', { name: /^Pour in / }).all())
      await expect(jar).toHaveAttribute('aria-describedby', id!)
  }

  async verifyJarsNotDescribed(): Promise<void> {
    for (const jar of await this.page.getByRole('button', { name: /^Pour in / }).all())
      await expect(jar).not.toHaveAttribute('aria-describedby', /.+/)
  }

  async watchAnnouncements(): Promise<void> {
    await this.page.evaluate(() => {
      const region = document.querySelector('ul ~ p[aria-live="polite"]')!
      const heard: string[] = []
      ;(window as unknown as { heard: string[] }).heard = heard
      new MutationObserver(() => heard.push(region.textContent ?? '')).observe(region, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    })
  }

  /** The live region was written to once per change, repeats included. */
  async verifyAnnouncementsHeard(expected: string[]): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => (window as unknown as { heard: string[] }).heard))
      .toEqual(expected)
  }

  async verifyAnnouncementIs(text: string): Promise<void> {
    await expect(this.page.locator('ul ~ p[aria-live="polite"]')).toHaveText(text)
  }
}
