import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Locator, Page } from '@playwright/test'

import { verifyNoPlayer, verifyPlayer } from './player.ts'
import { openAsNewVisitor, reloadAtRoot, verifyAt } from './address.ts'
import { ShelfPom } from './ShelfPom.ts'
import type { StreetPom } from './StreetPom.ts'

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

  async verifyNoStage(): Promise<void> {
    await expect(this.page.getByTestId('stage')).toHaveCount(0)
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

  async backToStreet(): Promise<StreetPom> {
    await this.page.getByRole('link', { name: 'Back to the street' }).click()
    // Imported late: StreetPom builds the shop page objects, which extend this class.
    const street = new (await import('./StreetPom.ts')).StreetPom(this.page)
    await street.verifyIsShown()
    return street
  }

  async verifyAt(path: string): Promise<void> {
    await verifyAt(this.page, path)
  }

  /** Opens the app again at its address, the root, as a visitor coming back does. */
  async reload(): Promise<void> {
    await reloadAtRoot(this.page)
  }

  /** A different visitor opening a link at its own address: nothing of their own saved. */
  async openAsNewVisitor(url: string): Promise<void> {
    await openAsNewVisitor(this.page, url, new URL(url).pathname)
  }

  /** Before mounting: the address the app first loads on, fragment untouched. */
  static async openAt(page: Page, pathWithFragment: string): Promise<void> {
    await page.evaluate((target) => window.history.pushState({}, '', target), pathWithFragment)
  }

  // Who is playing, and the shared view (ADR 0093 decision 6).

  async verifyPlayer(name: string): Promise<void> {
    await verifyPlayer(this.page, name)
  }

  async verifyNoPlayer(): Promise<void> {
    await verifyNoPlayer(this.page)
  }

  /** Where the header's title and motto end and its nav begins, and where the player circle and the header end. */
  async headerLayout(): Promise<{
    titleRight: number
    navLeft: number
    navRight: number
    playerRight: number
    right: number
  }> {
    const header = this.page.locator('header')
    const titleRight = await header
      .getByText('Armoury', { exact: true })
      .evaluate((title) =>
        Math.max(
          ...[...title.parentElement!.children]
            .filter((part) => getComputedStyle(part).display !== 'none')
            .map((part) => part.getBoundingClientRect().right),
        ),
      )
    const nav = (await header.getByRole('navigation').boundingBox())!
    const player = (await header.getByRole('img', { name: /^Playing as / }).boundingBox())!
    const box = (await header.boundingBox())!
    return {
      titleRight,
      navLeft: nav.x,
      navRight: nav.x + nav.width,
      playerRight: player.x + player.width,
      right: box.x + box.width,
    }
  }

  /** Nothing on screen offers to save: no shelf to put the item on. */
  async verifyNothingOffersToSave(): Promise<void> {
    await expect(this.page.getByRole('link', { name: /^Your shelf/ })).toHaveCount(0)
  }

  /** "Keep this" on `/shared`: returns the address it went to, a shop with the item in the fragment. */
  async keepShared(): Promise<string> {
    await this.page.getByRole('button', { name: this.copy.keep }).click()
    await this.page.waitForURL((url) => url.pathname !== '/shared', { waitUntil: 'commit' })
    return this.page.url()
  }

  async savePicture(): Promise<string> {
    const download = this.page.waitForEvent('download')
    await this.page.getByRole('button', { name: this.copy.picture }).click()
    return (await download).suggestedFilename()
  }
}
