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
  /** 'yes' once the bottle has been mixed. */
  mixed?: string
  effect?: string
  blend?: string
}

export const FULL_MESSAGE = 'The bottle is full. Tap it to mix it, or empty it to start again.'
export const MIXED_MESSAGE = 'This potion is mixed. Empty the bottle to make a new one.'

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
  private readonly emptyButton = this.page.getByRole('button', {
    name: 'Empty the bottle',
    exact: true,
  })

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

  async emptyBottle(): Promise<void> {
    await this.emptyButton.click()
  }

  /** The pours bottom first; the list reads like the bottle, empty rows above the top pour. */
  async verifyPours(labels: string[]): Promise<void> {
    await expect(this.bottleList.getByRole('listitem')).toHaveText([
      ...Array<RegExp>(3 - labels.length).fill(/^Empty$/),
      ...[...labels].reverse().map((label) => new RegExp(`^${label}$`)),
    ])
  }

  async verifyBottleHeading(text: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: text, exact: true })).toBeVisible()
  }

  async verifyFull(): Promise<void> {
    await this.verifyJarsShutBecause(FULL_MESSAGE)
  }

  async verifyMixed(): Promise<void> {
    await this.verifyJarsShutBecause(MIXED_MESSAGE)
  }

  private async verifyJarsShutBecause(message: string): Promise<void> {
    await expect(this.page.getByText(message, { exact: true })).toBeVisible()
    for (const jar of await this.page.getByRole('button', { name: /^Pour in / }).all())
      await expect(jar).toHaveAttribute('aria-disabled', 'true')
  }

  async verifyNotShut(): Promise<void> {
    await expect(this.page.getByText(FULL_MESSAGE, { exact: true })).toHaveCount(0)
    await expect(this.page.getByText(MIXED_MESSAGE, { exact: true })).toHaveCount(0)
    for (const jar of await this.page.getByRole('button', { name: /^Pour in / }).all())
      await expect(jar).not.toHaveAttribute('aria-disabled', 'true')
  }

  async verifyNoEmptyButton(): Promise<void> {
    await expect(this.emptyButton).toHaveCount(0)
  }

  async verifyNoTakeOutButton(): Promise<void> {
    await expect(
      this.page.getByRole('tabpanel').getByRole('button', { name: /take out/i }),
    ).toHaveCount(0)
  }

  async verifyNoMixedControl(): Promise<void> {
    await expect(this.page.getByText('Not mixed')).toHaveCount(0)
    await expect(this.page.getByRole('radio', { name: /^Mixed/ })).toHaveCount(0)
  }

  async verifyAnnouncement(text: string): Promise<void> {
    await expect(this.page.locator('ul ~ p[aria-live="polite"]')).toHaveText(text)
  }

  async pourWithKeyboard(label: string, key: 'Enter' | 'Space' = 'Enter'): Promise<void> {
    const name = `Pour in ${label}`
    for (let presses = 0; presses < 60; presses++) {
      await this.page.keyboard.press('Tab')
      const focused = await this.page.evaluate(() => document.activeElement?.ariaLabel ?? '')
      if (focused === name) {
        await this.page.keyboard.press(key)
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

  /** The jar shows its loaded picture, which says nothing to a screen reader. */
  async verifyJarPicture(label: string): Promise<void> {
    const picture = this.jar(label).locator('img')
    await expect(picture).toHaveAttribute('alt', '')
    await expect(picture).toHaveJSProperty('draggable', false)
    await expect
      .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBe(256)
  }

  /** A picture that did not load leaves the jar with a coloured swatch and no image. */
  async verifyJarSwatchOnly(label: string): Promise<void> {
    await expect(this.jar(label).locator('img')).toHaveCount(0)
    await expect(this.jar(label).locator('span[style*="background"]')).toHaveCount(1)
  }

  async verifyAllJarsShown(): Promise<void> {
    await expect(this.page.getByRole('button', { name: /^Pour in / })).toHaveCount(9)
  }

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
    const gap = await (
      await this.sheet()
    ).evaluate((box) => box.scrollHeight - box.clientHeight - box.scrollTop)
    expect(gap).toBeLessThanOrEqual(1)
  }

  async verifySheetScrolled(): Promise<void> {
    expect(await (await this.sheet()).evaluate((box) => box.scrollTop)).toBeGreaterThan(0)
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

  /** The jar's picture box is its first child, whether the picture loaded or the swatch stands in. */
  async pictureSize(): Promise<{ width: number; height: number }> {
    const box = (await this.page
      .getByRole('button', { name: /^Pour in / })
      .first()
      .locator('> span')
      .first()
      .boundingBox())!
    return { width: box.width, height: box.height }
  }

  private anyLock() {
    return this.page.getByRole('button', { name: /^Keep .* when trying another$/ })
  }

  /** The lock sits in the tab row, level with the tabs and clear of the last one. */
  async verifyLockInTabRow(): Promise<void> {
    const lock = (await this.anyLock().boundingBox())!
    const tabs = (await this.page.getByRole('tablist').boundingBox())!
    const lastTab = (await this.page.getByRole('tab').last().boundingBox())!
    expect(lock.y).toBeGreaterThanOrEqual(tabs.y)
    expect(lock.y + lock.height).toBeLessThanOrEqual(tabs.y + tabs.height + 1)
    expect(lock.x).toBeGreaterThanOrEqual(lastTab.x + lastTab.width)
    expect(lock.x + lock.width).toBeLessThanOrEqual((this.page.viewportSize()?.width ?? 0) + 1)
  }

  async verifyLockInBody(): Promise<void> {
    const lock = (await this.anyLock().boundingBox())!
    const panel = (await this.page.getByRole('tabpanel').boundingBox())!
    expect(lock.y).toBeGreaterThanOrEqual(panel.y)
  }

  /** The summary is read with the panel even where it is not drawn. */
  async verifySummaryInPanel(text: string): Promise<void> {
    await expect(this.page.getByRole('tabpanel').getByText(text, { exact: true })).toBeAttached()
  }

  /** The reason the jars are shut reads below the jars on a phone and above them on a desk. */
  async verifyMessageBelowJars(message: string, below: boolean): Promise<void> {
    const reason = (await this.page.getByText(message, { exact: true }).boundingBox())!
    const jars = await this.page.getByRole('button', { name: /^Pour in / }).all()
    const last = (await jars[8]!.boundingBox())!
    const first = (await jars[0]!.boundingBox())!
    if (below) expect(reason.y).toBeGreaterThanOrEqual(last.y + last.height)
    else expect(reason.y + reason.height).toBeLessThanOrEqual(first.y)
  }

  /** Every jar, and "Empty the bottle" when it shows, is at least 44 px tall and wide. */
  async verifyHitTargetsAtLeast44(): Promise<void> {
    const targets = [
      ...(await this.page.getByRole('button', { name: /^Pour in / }).all()),
      ...(await this.emptyButton.all()),
    ]
    for (const target of targets) {
      const box = (await target.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
  }

  /** The three rows sit in one column, top first, all one height whether filled or empty. */
  async verifyPoursInOneColumn(): Promise<void> {
    const rows = await this.bottleList.getByRole('listitem').all()
    expect(rows).toHaveLength(3)
    const boxes = await Promise.all(rows.map((row) => row.boundingBox()))
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.x).toBe(boxes[0]!.x)
      expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y)
      expect(boxes[i]!.height).toBe(boxes[0]!.height)
    }
  }

  async emptyBottleWithKeyboard(key: 'Enter' | 'Space' = 'Enter'): Promise<void> {
    await this.emptyButton.focus()
    await this.page.keyboard.press(key)
  }

  async verifyFocused(name: string): Promise<void> {
    await expect(this.page.getByRole('button', { name, exact: true })).toBeFocused()
  }

  async verifyJarsDescribedBy(text: string): Promise<void> {
    const message = this.page.getByText(text, { exact: true })
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
}
