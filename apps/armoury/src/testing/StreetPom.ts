import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { LAST_SHOP_KEY } from '../persistence/lastShop.ts'
import { SAVE_KEY } from '../persistence/storage.ts'
import { openAsNewVisitor, reloadAtRoot, reloadInPlace, verifyAt } from './address.ts'
import { ShopPom } from './ShopPom.ts'
import { SmithyPom } from './SmithyPom.ts'

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

  async reload(): Promise<void> {
    await reloadInPlace(this.page)
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
