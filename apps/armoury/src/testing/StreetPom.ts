import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { LAST_SHOP_KEY } from '../persistence/lastShop.ts'
import { SAVE_KEY } from '../persistence/storage.ts'
import { outlinePoints, SHOPS, STREET_PAINTING } from '../street/shops.ts'
import { openAsNewVisitor, reloadAtRoot, reloadInPlace, verifyAt } from './address.ts'
import { ShopPom } from './ShopPom.ts'
import { SmithyPom } from './SmithyPom.ts'

interface OldWand {
  params: Record<string, unknown>
  name?: string
}

export class StreetPom extends BasePage {
  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Armoury', level: 1 })).toBeVisible()
    await expect(this.shops()).toBeVisible()
    await expect(this.page.getByRole('link', { name: 'Back to home of ed' })).toBeVisible()
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

  /** Only these shops have their lit painting laid over the dark one, hidden from assistive tech. */
  async verifyLitShops(ids: string[]): Promise<void> {
    const lights = this.page.locator('[data-lights]')
    await expect(lights).toHaveCount(ids.length)
    for (const [i, id] of ids.entries()) {
      await expect(lights.nth(i)).toHaveAttribute('data-lights', id)
      await expect(lights.nth(i)).toHaveAttribute('aria-hidden', 'true')
    }
  }

  /** Taps the painted front of a shop that is not built yet. */
  async tapShutShop(id: string): Promise<void> {
    const shop = SHOPS.find((s) => s.id === id && !s.to)
    const painting = await this.shops().locator('svg').first().boundingBox()
    if (!shop || !painting) throw new Error(`no shut shop ${id} on the street`)
    const points = outlinePoints(shop.outline)
    const [xs, ys] = [points.map(([x]) => x), points.map(([, y]) => y)]
    const scale = painting.width / STREET_PAINTING.width
    const x = (Math.min(...xs) + Math.max(...xs)) / 2
    const y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.7
    await this.page.mouse.click(painting.x + x * scale, painting.y + y * scale)
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

  /** The shop is fully in view, not just a sliver of it. */
  async verifyDoorWhollyInView(name: string): Promise<void> {
    await expect(this.page.getByRole('link', { name })).toBeInViewport({ ratio: 0.99 })
  }

  /** The signposts under the street, one per open shop, in street order. */
  async verifySignposts(shopNames: string[]): Promise<void> {
    await expect(this.page.getByRole('button', { name: /^Show .* on the street$/ })).toHaveText(
      shopNames,
    )
    for (const name of shopNames) await expect(this.signpost(name)).toBeVisible()
  }

  async verifyHint(text: string): Promise<void> {
    await expect(this.page.getByText(text, { exact: true })).toBeVisible()
  }

  /** Taps a shop's signpost and waits for the street to come to rest. */
  async showOnStreet(shopName: string): Promise<void> {
    await this.signpost(shopName).click()
    await this.settledScroll()
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

  /** On a touch screen: taps a shop's front, which picks it rather than going in. */
  async tapShop(shopName: string): Promise<void> {
    await this.shopToggle(shopName).tap()
  }

  /** On a touch screen: the shop picked, its lights up and its Enter link shown, or nothing picked. */
  async verifyPicked(shopName: string | null): Promise<void> {
    const picked = this.shops().getByRole('button', { pressed: true })
    if (shopName === null) {
      await expect(picked).toHaveCount(0)
      await expect(this.page.getByRole('link', { name: /^Enter / })).toHaveCount(0)
      return
    }
    await expect(picked).toHaveAccessibleName(shopName)
    await expect(this.enterLink(shopName)).toBeVisible()
    const shop = SHOPS.find((s) => s.name === shopName)
    await this.verifyLights(shop?.id ?? '', '1')
  }

  async verifyLights(id: string, opacity: string): Promise<void> {
    await expect(this.page.locator(`[data-lights="${id}"]`)).toHaveCSS('opacity', opacity)
  }

  async verifySignpostCurrent(shopName: string): Promise<void> {
    await expect(this.signpost(shopName)).toHaveAttribute('aria-current', 'true')
  }

  async pointAt(name: string): Promise<void> {
    await this.page.getByRole('link', { name }).hover()
  }

  /** On a touch screen, the open shops are buttons to pick, never links. */
  async verifyShopsArePicked(shopNames: string[]): Promise<void> {
    await expect(this.shops().getByRole('link')).toHaveCount(0)
    await expect(this.shops().getByRole('button')).toHaveCount(shopNames.length)
    for (const name of shopNames) {
      await expect(this.shopToggle(name)).toHaveAttribute('aria-pressed', 'false')
    }
  }

  async verifyNoEnterLink(): Promise<void> {
    await expect(this.page.getByRole('link', { name: /^Enter / })).toHaveCount(0)
  }

  async pressEnterFor(shopName: string): Promise<void> {
    await this.enterLink(shopName).tap()
  }

  async enterSmithyWithEnter(): Promise<SmithyPom> {
    await this.pressEnterFor('The Ember Anvil')
    const smithy = new SmithyPom(this.page)
    await smithy.verifyIsShown()
    return smithy
  }

  async pressEnterKey(): Promise<void> {
    await this.page.keyboard.press('Enter')
  }

  /** Keyboard focus to a shop on a touch screen, then a press of Enter on it. */
  async pickByKeyboard(shopName: string): Promise<void> {
    const shop = this.shopToggle(shopName)
    for (let presses = 0; presses < 4; presses++) {
      if (await shop.evaluate((el) => el === document.activeElement)) break
      await this.page.keyboard.press('Tab')
    }
    await expect(shop).toBeFocused()
    await this.page.keyboard.press('Enter')
  }

  private shopToggle(shopName: string) {
    return this.shops().getByRole('button', { name: shopName, exact: true })
  }

  private enterLink(shopName: string) {
    return this.page.getByRole('link', { name: `Enter ${shopName}`, exact: true })
  }

  private signpost(shopName: string) {
    return this.page.getByRole('button', { name: `Show ${shopName} on the street` })
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
