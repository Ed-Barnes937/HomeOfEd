import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { LAST_SHOP_KEY } from '../persistence/lastShop.ts'
import { SAVE_KEY } from '../persistence/storage.ts'
import { openAsNewVisitor, reloadAtRoot, reloadInPlace, verifyAt } from './address.ts'
import { ShopPom } from './ShopPom.ts'
import { SmithyPom } from './SmithyPom.ts'

type Side = 'left' | 'right'

interface OldWand {
  params: Record<string, unknown>
  name?: string
}

export class StreetPom extends BasePage {
  async verifyIsShown(): Promise<void> {
    await this.verifyDoors()
  }

  async verifyDoors(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Armoury', level: 1 })).toBeVisible()
    await expect(this.page.getByRole('link', { name: 'Go into the wand shop' })).toBeVisible()
    await expect(this.page.getByRole('link', { name: 'Go into the smithy' })).toBeVisible()
    await expect(this.page.getByRole('link', { name: 'Back to home of ed' })).toBeVisible()
  }

  /** The built shops are the only doors; the rest are not links at all. */
  async verifyOnlyOpenShopsAreDoors(): Promise<void> {
    const doors = this.shops().getByRole('link')
    await expect(doors).toHaveCount(2)
    await expect(doors.nth(0)).toHaveAccessibleName('Go into the wand shop')
    await expect(doors.nth(1)).toHaveAccessibleName('Go into the smithy')
  }

  /** Taps the painted front of a shop that is not built yet. */
  async tapShutShop(id: string): Promise<void> {
    const box = await this.page.locator(`[data-shut="${id}"]`).boundingBox()
    if (!box) throw new Error(`no shut shop ${id} on the street`)
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.7)
  }

  async enterWandShopByKeyboard(): Promise<ShopPom> {
    await this.focusDoor('Go into the wand shop')
    await this.page.keyboard.press('Enter')
    const shop = new ShopPom(this.page)
    await shop.verifyIsShown()
    return shop
  }

  /** Tabs from the top of the page until the door has focus. */
  async focusDoor(name: string): Promise<void> {
    const door = this.page.getByRole('link', { name })
    for (let presses = 0; presses < 4; presses++) {
      if (await door.evaluate((el) => el === document.activeElement)) break
      await this.page.keyboard.press('Tab')
    }
    await expect(door).toBeFocused()
  }

  async verifyDoorsInView(names: string[]): Promise<void> {
    for (const name of names) {
      await expect(this.page.getByRole('link', { name })).toBeInViewport()
    }
  }

  async verifyDoorOutOfView(name: string): Promise<void> {
    await expect(this.page.getByRole('link', { name })).not.toBeInViewport()
  }

  async verifyMoreStreet(side: Side): Promise<void> {
    await expect(this.moreStreet(side)).toBeVisible()
  }

  async verifyNoMoreStreet(side: Side): Promise<void> {
    await expect(this.moreStreet(side)).toHaveCount(0)
  }

  /** Taps the arrow on one side until the street runs out that way. */
  async walkStreetToEnd(side: Side): Promise<void> {
    const arrow = this.moreStreet(side)
    for (let taps = 0; taps < 10 && (await arrow.count()) > 0; taps++) {
      const before = await this.settledScroll()
      await arrow.click()
      await expect.poll(() => this.settledScroll()).not.toBe(before)
    }
    await expect(arrow).toHaveCount(0)
  }

  async verifyTitleInView(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Armoury', level: 1 })).toBeInViewport()
    await expect(this.page.getByRole('link', { name: 'Back to home of ed' })).toBeInViewport()
  }

  async verifyAt(path: string): Promise<void> {
    await verifyAt(this.page, path)
  }

  async enterWandShop(): Promise<ShopPom> {
    await this.page.getByRole('link', { name: 'Go into the wand shop' }).click()
    const shop = new ShopPom(this.page)
    await shop.verifyIsShown()
    return shop
  }

  async enterSmithy(): Promise<SmithyPom> {
    await this.page.getByRole('link', { name: 'Go into the smithy' }).click()
    const smithy = new SmithyPom(this.page)
    await smithy.verifyIsShown()
    return smithy
  }

  private moreStreet(side: Side) {
    return this.page.getByRole('button', { name: `More street to the ${side}` })
  }

  /** How far along the street the view is, once a smooth scroll has come to rest. */
  private settledScroll(): Promise<number> {
    return this.shops().evaluate(
      (el) =>
        new Promise<number>((resolve) => {
          let last = el.scrollLeft
          const check = () =>
            setTimeout(() => {
              if (el.scrollLeft === last) resolve(last)
              else {
                last = el.scrollLeft
                check()
              }
            }, 120)
          check()
        }),
    )
  }

  private shops() {
    return this.page.getByRole('navigation', { name: 'Shops' })
  }

  async reload(): Promise<void> {
    await reloadInPlace(this.page)
  }

  /** The same visitor typing `path` into the address bar. */
  async openAt(path: string): Promise<void> {
    await reloadAtRoot(this.page)
    await this.page.evaluate((to) => window.history.replaceState(null, '', to), path)
  }

  /** A different visitor opening a link at `path`. */
  async openAsNewVisitor(url: string, path?: string): Promise<void> {
    await openAsNewVisitor(this.page, url, path)
  }

  /** Comes back with a save written before there were two shops: a wand and a shelf, no last shop. */
  async openWithOldSave(save: { working: OldWand; shelf: OldWand[] }): Promise<void> {
    await reloadAtRoot(this.page)
    await this.page.evaluate(
      ([saveKey, shopKey, saved]) => {
        window.localStorage.setItem(saveKey, saved)
        window.localStorage.removeItem(shopKey)
      },
      [SAVE_KEY, LAST_SHOP_KEY, JSON.stringify({ version: 1, ...save })] as const,
    )
  }
}
