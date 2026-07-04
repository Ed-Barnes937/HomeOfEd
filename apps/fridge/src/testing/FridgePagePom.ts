import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Locator } from '@playwright/test'

export class FridgePagePom extends BasePage {
  private magnets(): Locator {
    return this.page.getByTestId('magnet')
  }

  private magnet(index: number): Locator {
    return this.magnets().nth(index)
  }

  private chip(name: string): Locator {
    return this.page.getByTestId('saved-chip').filter({ hasText: name })
  }

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByTestId('fridge-page')).toBeVisible()
    await expect(this.page.getByTestId('fridge-door')).toBeVisible()
  }

  async verifyTrayHasThreeTabs(): Promise<void> {
    await expect(this.page.getByTestId('fridge-tray')).toBeVisible()
    await expect(this.page.getByRole('button', { name: 'A B C' })).toBeVisible()
    await expect(this.page.getByRole('button', { name: '1 2 3' })).toBeVisible()
    await expect(this.page.getByRole('button', { name: 'Shapes' })).toBeVisible()
  }

  async verifyDemoBoard(): Promise<void> {
    // HELLO letters + a number + two fraction discs = 8 magnets.
    await expect(this.magnets()).toHaveCount(8)
    for (const label of ['H', 'E', 'O', '3']) {
      await expect(this.magnets().filter({ hasText: label }).first()).toBeVisible()
    }
    await expect(this.page.locator('[data-type="fraction"]')).toHaveCount(2)
  }

  async verifyMagnetCount(n: number): Promise<void> {
    await expect(this.magnets()).toHaveCount(n)
  }

  async verifyLastMagnetLabel(label: string): Promise<void> {
    await expect(this.magnets().last()).toHaveText(label)
  }

  /** Click empty fridge surface (top-left corner, clear of the demo board). */
  async clickEmptySurface(): Promise<void> {
    await this.page.getByTestId('fridge-door').click({ position: { x: 20, y: 20 } })
  }

  async selectFinish(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label, exact: true }).click()
  }

  async verifyDoorFinish(finish: string): Promise<void> {
    await expect(this.page.locator('[data-finish]')).toHaveAttribute('data-finish', finish)
  }

  async selectLight(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label, exact: true }).click()
  }

  async verifyLightWall(wall: string): Promise<void> {
    await expect(this.page.locator('[data-wall]')).toHaveAttribute('data-wall', wall)
  }

  /** Tap a tray tile (letter/number/shape) to spawn that magnet. */
  async tapTile(name: string): Promise<void> {
    await this.page.getByRole('button', { name, exact: true }).click()
  }

  /** Switch the tray tab (e.g. '1 2 3' or 'Shapes'). */
  async selectTab(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label }).click()
  }

  async clickMagnet(index: number): Promise<void> {
    await this.magnet(index).click()
  }

  async doubleClickMagnet(index: number): Promise<void> {
    await this.magnet(index).dblclick()
  }

  async verifySelectionShown(): Promise<void> {
    await expect(this.page.getByTestId('selection-overlay')).toBeVisible()
    await expect(this.page.getByTestId('magnet-knob')).toBeVisible()
  }

  async verifyNoSelection(): Promise<void> {
    await expect(this.page.getByTestId('selection-overlay')).toHaveCount(0)
  }

  async clickDelete(): Promise<void> {
    await this.page.getByTestId('magnet-delete').click()
  }

  private async transformOf(index: number): Promise<string> {
    return this.magnet(index).evaluate((el) => (el as HTMLElement).style.transform)
  }

  /** Scroll-wheel over a magnet and assert its rotation transform changed. */
  async verifyWheelRotates(index: number): Promise<void> {
    const before = await this.transformOf(index)
    await this.magnet(index).hover()
    await this.page.mouse.wheel(0, 200)
    await expect
      .poll(() => this.transformOf(index))
      .not.toBe(before)
  }

  private async centre(index: number): Promise<{ x: number; y: number }> {
    const box = await this.magnet(index).boundingBox()
    if (!box) throw new Error(`magnet ${index} has no bounding box`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  private async leftOf(index: number): Promise<number> {
    const box = await this.magnet(index).boundingBox()
    if (!box) throw new Error(`magnet ${index} has no bounding box`)
    return box.x
  }

  /**
   * Drag magnet `from` on top of magnet `to` and assert the neighbour (`to`)
   * was displaced — the bump. Uses real pointer down/move/up so pointer
   * capture and the engine's relax both run.
   */
  async verifyDragBumps(from: number, to: number): Promise<void> {
    const beforeLeft = await this.leftOf(to)
    const start = await this.centre(from)
    const target = await this.centre(to)
    await this.page.mouse.move(start.x, start.y)
    await this.page.mouse.down()
    await this.page.mouse.move(target.x, target.y, { steps: 10 })
    await this.page.mouse.up()
    await expect.poll(() => this.leftOf(to)).not.toBe(beforeLeft)
  }

  async setNameInput(value: string): Promise<void> {
    await this.page.getByPlaceholder('name this fridge…').fill(value)
  }

  async verifyNameInputValue(value: string): Promise<void> {
    await expect(this.page.getByPlaceholder('name this fridge…')).toHaveValue(value)
  }

  async clickSave(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save' }).click()
  }

  async clickNew(): Promise<void> {
    await this.page.getByRole('button', { name: 'New' }).click()
  }

  async clickClear(): Promise<void> {
    await this.page.getByRole('button', { name: 'Clear' }).click()
  }

  async verifyChip(name: string): Promise<void> {
    await expect(this.chip(name)).toBeVisible()
  }

  async verifyNoChip(name: string): Promise<void> {
    await expect(this.chip(name)).toHaveCount(0)
  }

  async verifyActiveChip(name: string): Promise<void> {
    await expect(this.chip(name)).toHaveAttribute('data-active', 'true')
  }

  /** Loads a chip by clicking away from its trailing × (which deletes instead). */
  async loadChip(name: string): Promise<void> {
    await this.chip(name).click({ position: { x: 5, y: 5 } })
  }

  async deleteChip(name: string): Promise<void> {
    await this.chip(name).getByRole('button', { name: `delete ${name}` }).click()
  }

  private async readPersistedCurrent(): Promise<{
    name: string
    finish: string
    wall: string
    magnets: unknown[]
  } | null> {
    const raw = await this.page.evaluate(() => window.localStorage.getItem('fridge:v1'))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      current: { name: string; finish: string; wall: string; magnets: unknown[] }
    }
    return parsed.current
  }

  async verifyPersistedCurrentName(name: string): Promise<void> {
    await expect.poll(async () => (await this.readPersistedCurrent())?.name).toBe(name)
  }

  async verifyPersistedFinish(finish: string): Promise<void> {
    await expect.poll(async () => (await this.readPersistedCurrent())?.finish).toBe(finish)
  }

  async verifyPersistedWall(wall: string): Promise<void> {
    await expect.poll(async () => (await this.readPersistedCurrent())?.wall).toBe(wall)
  }

  async verifyPersistedMagnetCount(n: number): Promise<void> {
    await expect.poll(async () => (await this.readPersistedCurrent())?.magnets.length).toBe(n)
  }

  // ---- share / import (F12) ----

  /** Client-side navigate to a route (no reload); popstate drives the router. */
  async gotoSharedBoard(id: string): Promise<void> {
    await this.page.evaluate((path) => {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, `/b/${id}`)
  }

  async verifyPathIsRoot(): Promise<void> {
    await expect.poll(() => this.page.evaluate(() => window.location.pathname)).toBe('/')
  }

  async verifySharedNotFound(): Promise<void> {
    await expect(this.page.getByTestId('shared-not-found')).toBeVisible()
  }

  async clickShare(): Promise<void> {
    await this.page.getByTestId('share-button').click()
  }

  /** The share result surfaces a canonical `/b/<10-char id>` link. */
  async verifyShareUrlShown(): Promise<void> {
    await expect(this.page.getByTestId('share-url')).toHaveValue(/\/b\/[A-Za-z0-9]{10}$/)
  }

  /** The 10-char id from the surfaced share URL (for a full share→open loop). */
  async readShareId(): Promise<string> {
    await this.verifyShareUrlShown()
    const url = await this.page.getByTestId('share-url').inputValue()
    return url.slice(url.lastIndexOf('/b/') + '/b/'.length)
  }
}
