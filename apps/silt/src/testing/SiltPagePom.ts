import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import { TEST_SEAM_KEY, type SiltTestSeam } from '../features/sim/useSimLoop.ts'

export class SiltPagePom extends BasePage {
  private readonly canvas = this.page.getByTestId('silt-canvas')
  private readonly playToggle = this.page.getByTestId('play-toggle')
  private readonly stepButton = this.page.getByTestId('step')
  private readonly resetButton = this.page.getByTestId('reset')
  private readonly eraseButton = this.page.getByTestId('erase-tool')
  private readonly runPill = this.page.getByTestId('run-pill')
  private readonly firstVisitHint = this.page.getByTestId('first-visit-hint')

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByText('SILT')).toBeVisible()
    await expect(this.canvas).toBeVisible()
  }

  async selectElement(name: string): Promise<void> {
    await this.page.getByTestId(`element-${name}`).click()
  }

  async isSelected(name: string): Promise<boolean> {
    const pressed = await this.page.getByTestId(`element-${name}`).getAttribute('aria-pressed')
    return pressed === 'true'
  }

  /**
   * Nothing that holds an element reads as pressed - the palette's swatches and
   * the EARNED control alike, which sits outside the palette div and stands in
   * for a selection kept inside it. That is the state erase has to leave the
   * rail in: a lit swatch would say the rail is still painting, which is what
   * hid the way out of erase (ticket 24). The brush, mode and erase controls are
   * deliberately out of scope - they are not elements and stay lit.
   */
  async verifyNoElementSelected(): Promise<void> {
    await expect(
      this.page.locator(
        '[data-testid="palette"] [aria-pressed="true"], [data-testid="earned-button"][aria-pressed="true"]',
      ),
    ).toHaveCount(0)
  }

  /** A rail group section and one of the swatches inside it (spec §9). */
  async verifyPaletteGroupContains(label: string, name: string): Promise<void> {
    const group = this.page.getByTestId(`palette-group-${label}`)
    await expect(group).toBeVisible()
    await expect(group.getByTestId(`element-${name}`)).toBeVisible()
  }

  // ---- the rail's EARNED control (discovery-tree spec §6, §9.8) ---------

  /** The control only exists once something has been unlocked. */
  async verifyNoEarnedControl(): Promise<void> {
    await expect(this.page.getByTestId('earned-button')).toHaveCount(0)
  }

  async openEarned(): Promise<void> {
    await this.page.getByTestId('earned-button').click()
    await expect(this.page.getByTestId('earned-popover')).toBeVisible()
  }

  /**
   * The open popover must not be clipped by the rail, which is a scroll
   * container: anything positioned against the control inside it turns the rail
   * into a sideways scroller and cuts the popover off at its edge.
   */
  async verifyEarnedPopoverClearsTheRail(): Promise<void> {
    const scrolls = await this.page.evaluate(() => {
      const rail = document.querySelector('nav[aria-label="tools"]')
      if (!rail) throw new Error('the rail is not on the page')
      return rail.scrollWidth > rail.clientWidth
    })
    expect(scrolls).toBe(false)
  }

  /**
   * The popover belongs to the control, not to the viewport's corner (ticket
   * 13): it opens clear of the rail, level with the control, and lies wholly on
   * screen.
   */
  async verifyEarnedPopoverIsAnchoredToTheControl(): Promise<void> {
    // Polled: a resize is placed on the frame after the event, so reading the
    // boxes once would be a race rather than an assertion.
    await expect
      .poll(() => this.earnedPopoverPlacement())
      .toEqual({
        clearOfTheRail: true,
        levelWithTheControl: true,
        onScreen: true,
      })
  }

  /**
   * The three things the desktop placement has to be true of, read in one pass
   * off the live boxes so they can be polled together. Every box comes from
   * inside the page: `boundingBox()` is in document coordinates, and a `fixed`
   * box has to be compared against the viewport it is pinned to.
   */
  private async earnedPopoverPlacement(): Promise<{
    clearOfTheRail: boolean
    levelWithTheControl: boolean
    onScreen: boolean
  }> {
    return this.page.evaluate(() => {
      const rail = document.querySelector('nav[aria-label="tools"]')?.getBoundingClientRect()
      const control = document
        .querySelector('[data-testid="earned-button"]')
        ?.getBoundingClientRect()
      const popover = document
        .querySelector('[data-testid="earned-popover"]')
        ?.getBoundingClientRect()
      if (!rail || !control || !popover)
        throw new Error('the rail, control or popover is not shown')

      return {
        // Beside the rail rather than over its trailing edge - the placement
        // both tested viewports have room for.
        clearOfTheRail: popover.left >= rail.right,
        // Clamping may lift the box, but never as far as the screen's corner:
        // it still overlaps the control's own band.
        levelWithTheControl: popover.top <= control.bottom && popover.bottom >= control.top,
        onScreen:
          popover.left >= 0 &&
          popover.top >= 0 &&
          popover.right <= window.innerWidth &&
          popover.bottom <= window.innerHeight,
      }
    })
  }

  /**
   * The phone's variant: a sheet taking the bar's place across the foot of the
   * screen, which is the mobile idiom and is not what ticket 13 changed. This
   * is also what catches the two halves of the breakpoint drifting apart - the
   * sheet is a stylesheet rule, and an inline offset would beat it.
   */
  async verifyEarnedPopoverIsASheet(): Promise<void> {
    const sheet = await this.page.evaluate(() => {
      const popover = document
        .querySelector('[data-testid="earned-popover"]')
        ?.getBoundingClientRect()
      if (!popover) throw new Error('the earned popover is not shown')

      return {
        atTheLeftEdge: popover.left === 0,
        // The layout viewport, which under Playwright's mobile emulation is
        // *not* `viewportSize()`: with no meta viewport tag it falls back to
        // 980 CSS px, and that is the frame a fixed box is laid out in.
        fullWidth: Math.abs(popover.width - window.innerWidth) < 0.5,
        atTheFoot: Math.abs(popover.bottom - window.innerHeight) < 0.5,
      }
    })

    expect(sheet).toEqual({ atTheLeftEdge: true, fullWidth: true, atTheFoot: true })
  }

  /** Picks an earned element for painting, exactly as a rail swatch does. */
  async selectEarnedElement(name: string): Promise<void> {
    await this.page.getByTestId(`earned-element-${name}`).click()
  }

  async earnedElementNames(): Promise<string[]> {
    const testIds = await this.page
      .getByTestId(/^earned-element-/)
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''))
    return testIds.map((id) => id.replace('earned-element-', ''))
  }

  /** Whether the rail's control shows that the current selection lives inside it. */
  async isEarnedSelected(): Promise<boolean> {
    const pressed = await this.page.getByTestId('earned-button').getAttribute('aria-pressed')
    return pressed === 'true'
  }

  // ---- field notes (discovery-tree spec §6) -----------------------------

  private readonly notesButton = this.page.getByTestId('field-notes-button')
  private readonly notesPanel = this.page.getByTestId('field-notes-panel')

  /** What the header chip reads, `witnessed/total`. */
  async fieldNotesCount(): Promise<string> {
    return this.statusText('field-notes-count')
  }

  /**
   * The chip's three resting states (spec §6): greyed numerals until the first
   * witness, plain in progress, inverted for good at `n/n`. The fourth - the
   * ~250ms inversion as a count ticks up - is deliberately not asserted here:
   * catching a quarter-second of styling in a browser is a flake, and the count
   * itself ticking is what the witness tests watch.
   */
  async verifyFieldNotesChip(state: 'untouched' | 'in progress' | 'complete'): Promise<void> {
    const chip = this.notesButton
    if (state === 'untouched') await expect(chip).toHaveClass(/untouched/)
    else await expect(chip).not.toHaveClass(/untouched/)

    if (state === 'complete') await expect(chip).toHaveClass(/inverted/)
    else await expect(chip).not.toHaveClass(/inverted/)
  }

  /** The rail's teaser: it says there is more to earn, never what (spec §7). */
  async verifyMoreToEarn(shown: boolean): Promise<void> {
    const teaser = this.page.getByTestId('earned-more')
    if (shown) await expect(teaser).toBeVisible()
    else await expect(teaser).toHaveCount(0)
  }

  async openFieldNotes(): Promise<void> {
    await this.notesButton.click()
    await expect(this.notesPanel).toBeVisible()
  }

  async closeFieldNotes(): Promise<void> {
    await this.page.getByTestId('field-notes-close').click()
    await expect(this.notesPanel).toHaveCount(0)
  }

  /** The panel's two pinned counters, and the `NEW n` chip when it is showing. */
  async fieldNotesCounters(): Promise<{ elements: string; interactions: string; fresh: string }> {
    const chip = this.page.getByTestId('field-notes-new')
    return {
      elements: await this.statusText('field-notes-elements'),
      interactions: await this.statusText('field-notes-interactions'),
      fresh: (await chip.count()) === 0 ? '' : ((await chip.textContent()) ?? ''),
    }
  }

  /** Picks an element in the picker column; the ring follows. */
  async selectNote(name: string): Promise<void> {
    await this.page.getByTestId(`field-notes-row-${name}`).click()
  }

  /** The name under the ring's centre tile. */
  async focusedNote(): Promise<string> {
    return this.statusText('field-notes-centre')
  }

  /**
   * The tag chips under the ring centre's name, in the order they are drawn.
   * `allTextContents`, not `allInnerTexts`: the chips are uppercased in CSS, and
   * the words the model chose are what this is asserting.
   */
  async focusedNoteTags(): Promise<string[]> {
    return this.page.getByTestId('field-notes-tag').allTextContents()
  }

  /**
   * The chips sit at a fixed px offset under the centre name while the ring
   * itself is sized off the viewport, so the phone sheet's smaller ring is the
   * one layout where they could end up under a spoke tile (ticket 12). Asserts
   * they are drawn and that no spoke tile overlaps them.
   */
  async verifyFocusedNoteTagsAreClearOfTheRing(): Promise<void> {
    const chips = this.page.getByTestId('field-notes-tag')
    await expect(chips.first()).toBeVisible()

    const boxes = await chips.all().then((all) => Promise.all(all.map((chip) => chip.boundingBox())))
    const tiles = await this.page
      .getByTestId(/^field-notes-spoke-/)
      .all()
      .then((all) => Promise.all(all.map((tile) => tile.boundingBox())))

    for (const chip of boxes) {
      expect(chip).not.toBeNull()
      for (const tile of tiles) {
        if (!chip || !tile) continue
        const apart =
          chip.x + chip.width <= tile.x ||
          tile.x + tile.width <= chip.x ||
          chip.y + chip.height <= tile.y ||
          tile.y + tile.height <= chip.y
        expect(apart).toBe(true)
      }
    }
  }

  /** What a picker row says about itself: its label and its `seen/total`. */
  async noteRow(name: string): Promise<string> {
    return (await this.page.getByTestId(`field-notes-row-${name}`).textContent()) ?? ''
  }

  /** Fresh install: no ring at all, just the copy that says where to start. */
  async verifyFieldNotesEmpty(): Promise<void> {
    await expect(this.page.getByTestId('field-notes-empty')).toBeVisible()
    await expect(this.page.getByTestId('field-notes-ring')).toHaveCount(0)
  }

  /** The drawn star after a mastered element's name (spec §6). */
  async verifyNoteMastered(name: string, mastered: boolean): Promise<void> {
    const star = this.page.getByTestId(`field-notes-row-${name}`).getByLabel('mastered')
    if (mastered) await expect(star).toBeVisible()
    else await expect(star).toHaveCount(0)
  }

  /** An undiscovered element keeps its slot but is not a control (spec §7). */
  async verifyNoteRowIsInert(name: string): Promise<void> {
    const row = this.page.getByTestId(`field-notes-row-${name}`)
    await expect(row).toBeVisible()
    await expect(row).toBeDisabled()
    await expect(row).toContainText('?')
  }

  /** Follows a product tile under a spoke's words - the way into its own entry. */
  async followProduct(name: string): Promise<void> {
    await this.page.getByTestId(`field-notes-product-${name}`).click()
  }

  /**
   * Follows the element on the ring itself. The first of them: a ring can draw
   * one element on several spokes - and, since ticket 09, in several stacks -
   * and every tile with that name leads to the same place.
   */
  async followSpoke(name: string): Promise<void> {
    await this.page.getByTestId(`field-notes-spoke-${name}`).first().click()
  }

  /** Every tile on the ring: one per spoke, or one per member of a merged one. */
  async noteSpokeCount(): Promise<number> {
    return this.page.getByTestId(/^field-notes-spoke-/).count()
  }

  /** The spokes actually drawn - lines on the ring, however many pairs each stands for. */
  async noteDrawnSpokeCount(): Promise<number> {
    return this.page.getByTestId('field-notes-line').count()
  }

  /** The `2/5` chips under the merged spokes' stacks (ticket 09), in ring order. */
  async noteGroupCounts(): Promise<string[]> {
    return this.page.getByTestId('field-notes-group-count').allTextContents()
  }

  /**
   * Ticket 17: the product tiles used to hang below their point whatever the
   * spoke did, which put them on top of the outward arrowhead on the ring's
   * lower half - worst on a phone, where the words are hidden and the tiles are
   * all that is drawn. Asserts no tile row overlaps any arrowhead.
   */
  async verifySpokeTilesClearArrowheads(): Promise<void> {
    const tiles = await this.page
      .getByTestId('field-notes-tiles')
      .all()
      .then((all) => Promise.all(all.map((row) => row.boundingBox())))
    const heads = await this.page
      .locator('[data-testid="field-notes-ring"] polygon')
      .all()
      .then((all) => Promise.all(all.map((head) => head.boundingBox())))

    // Both sides have to be on the screen for the comparison to mean anything:
    // a sheet that stopped drawing either would otherwise pass this vacuously.
    expect(heads.length).toBeGreaterThan(0)
    expect(tiles.filter((row) => row && row.width > 0).length).toBeGreaterThan(0)

    for (const row of tiles) {
      if (!row || row.width === 0) continue
      for (const head of heads) {
        if (!head) continue
        const apart =
          row.x + row.width <= head.x ||
          head.x + head.width <= row.x ||
          row.y + row.height <= head.y ||
          head.y + head.height <= row.y
        expect(apart).toBe(true)
      }
    }
  }

  async noteStillToFind(): Promise<string> {
    return this.statusText('field-notes-still-to-find')
  }

  /** Opens or closes the footer's key - the line kinds the ring draws (ticket 11). */
  async toggleFieldNotesKey(): Promise<void> {
    await this.page.getByTestId('field-notes-key-toggle').click()
  }

  /** Whether the key is open at all - collapsed means it is not in the DOM. */
  async verifyFieldNotesKey(shown: boolean): Promise<void> {
    const key = this.page.getByTestId('field-notes-key')
    if (shown) await expect(key).toBeVisible()
    else await expect(key).toHaveCount(0)
  }

  /** One row of the open key, by the stroke or rule it explains. */
  async verifyFieldNotesKeyRow(row: string): Promise<void> {
    await expect(this.page.getByTestId(`field-notes-key-${row}`)).toBeVisible()
  }

  async fieldNotesKeyText(): Promise<string> {
    const key = this.page.getByTestId('field-notes-key')
    return (await key.count()) === 0 ? '' : ((await key.innerText()) ?? '')
  }

  /** Every word the open panel renders - the assertion the spoiler policy needs. */
  async fieldNotesText(): Promise<string> {
    return (await this.notesPanel.innerText()) ?? ''
  }

  // ---- moments over the world (discovery-tree spec §6) -------------------

  private readonly moment = this.page.getByTestId('field-notes-moment')

  /** What the card over the canvas reads, or '' while there is no card. */
  async momentText(): Promise<string> {
    return (await this.moment.count()) === 0 ? '' : ((await this.moment.textContent()) ?? '')
  }

  /** Waits for a card saying `text` - a burst shows one card at a time. */
  async verifyMomentCard(text: string | RegExp): Promise<void> {
    await expect(this.moment).toContainText(text, { timeout: 15_000 })
  }

  async verifyNoMomentCard(): Promise<void> {
    await expect(this.moment).toHaveCount(0)
  }

  /** The one-time 100% line, in the first-visit hint's own type (spec §6). */
  async verifyChartCompleteLine(): Promise<void> {
    await expect(this.page.getByTestId('field-notes-complete')).toBeVisible()
  }

  async verifyNoChartCompleteLine(): Promise<void> {
    await expect(this.page.getByTestId('field-notes-complete')).toHaveCount(0)
  }

  /** One click arms, the second forgets everything (spec §5). */
  async forgetDiscoveries(): Promise<void> {
    const button = this.page.getByTestId('field-notes-forget')
    await button.click()
    await expect(button).toHaveText(/sure/)
    await button.click()
  }

  async selectBrush(index: number): Promise<void> {
    await this.page.getByTestId(`brush-${index}`).click()
  }

  async isBrushSelected(index: number): Promise<boolean> {
    const pressed = await this.page.getByTestId(`brush-${index}`).getAttribute('aria-pressed')
    return pressed === 'true'
  }

  async selectErase(): Promise<void> {
    await this.eraseButton.click()
  }

  async isEraseSelected(): Promise<boolean> {
    const pressed = await this.eraseButton.getAttribute('aria-pressed')
    return pressed === 'true'
  }

  async enterSpawnerMode(): Promise<void> {
    await this.page.getByTestId('mode-spawner').click()
  }

  async enterPaintMode(): Promise<void> {
    await this.page.getByTestId('mode-paint').click()
  }

  async isSpawnerModeSelected(): Promise<boolean> {
    const pressed = await this.page.getByTestId('mode-spawner').getAttribute('aria-pressed')
    return pressed === 'true'
  }

  /** Clicks a grid cell — in spawner mode this places or removes a spawner (spec §7). */
  async clickCell(x: number, y: number): Promise<void> {
    await this.paintCell(x, y)
  }

  async verifySpawnerAt(x: number, y: number): Promise<void> {
    await expect(this.page.getByTestId(`spawner-${x}-${y}`)).toBeVisible()
  }

  async verifyNoSpawnerAt(x: number, y: number): Promise<void> {
    await expect(this.page.getByTestId(`spawner-${x}-${y}`)).toHaveCount(0)
  }

  /** The chrome saying a click or stroke here will take this spawner (spec §7). */
  async verifySpawnerMarkedForRemoval(x: number, y: number): Promise<void> {
    await expect(this.page.getByTestId(`spawner-${x}-${y}`)).toHaveClass(/spawnerRemove/)
  }

  async verifySpawnerNotMarkedForRemoval(x: number, y: number): Promise<void> {
    await expect(this.page.getByTestId(`spawner-${x}-${y}`)).not.toHaveClass(/spawnerRemove/)
  }

  async spawnerCount(): Promise<string> {
    return this.statusText('status-spawners')
  }

  async modeText(): Promise<string> {
    return this.statusText('status-mode')
  }

  async step(): Promise<void> {
    await this.stepButton.click()
  }

  /** Clicks reset once (arms it) without confirming. */
  async clickReset(): Promise<void> {
    await this.resetButton.click()
  }

  /** Clicks reset twice — the required confirm (spec §3). */
  async confirmReset(): Promise<void> {
    await this.resetButton.click()
    await this.resetButton.click()
  }

  async isResetArmed(): Promise<boolean> {
    return (await this.resetButton.textContent())?.includes('confirm') ?? false
  }

  async verifyRunning(): Promise<void> {
    await expect(this.runPill).toHaveText(/running/)
  }

  async verifyPaused(): Promise<void> {
    await expect(this.runPill).toHaveText(/paused/)
  }

  async verifyFirstVisitHintVisible(): Promise<void> {
    await expect(this.firstVisitHint).toBeVisible()
  }

  async verifyFirstVisitHintGone(): Promise<void> {
    await expect(this.firstVisitHint).toHaveCount(0)
  }

  /** It stays mounted and transitions out rather than vanishing on the spot. */
  async verifyFirstVisitHintFadingOut(): Promise<void> {
    await expect(this.firstVisitHint).toHaveClass(/Fading/)
  }

  // ---- scenes popover (spec §9) ----------------------------------------

  async openScenes(): Promise<void> {
    await this.page.getByTestId('scenes-button').click()
    await expect(this.page.getByTestId('scenes-popover')).toBeVisible()
  }

  async closeScenes(): Promise<void> {
    await this.page.getByTestId('scenes-close').click()
    await expect(this.page.getByTestId('scenes-popover')).toHaveCount(0)
  }

  async saveScene(): Promise<void> {
    await this.page.getByTestId('scene-save').click()
  }

  async loadScene(name: string): Promise<void> {
    await this.page.getByTestId(`scene-load-${name}`).click()
  }

  async duplicateScene(name: string): Promise<void> {
    await this.page.getByTestId(`scene-duplicate-${name}`).click()
  }

  async verifySceneRow(name: string): Promise<void> {
    await expect(this.page.getByTestId(`scene-row-${name}`)).toBeVisible()
  }

  async verifyNoSceneRow(name: string): Promise<void> {
    await expect(this.page.getByTestId(`scene-row-${name}`)).toHaveCount(0)
  }

  async sceneRowCount(): Promise<number> {
    return this.page.getByTestId('scenes-popover').getByRole('listitem').count()
  }

  /** When the row says it was last saved. */
  async sceneUpdatedAt(name: string): Promise<string> {
    return this.statusText(`scene-updated-${name}`)
  }

  /** The row's thumbnail as its PNG data URL — comparable between rows. */
  async sceneThumbnail(name: string): Promise<string> {
    const src = await this.page
      .getByTestId(`scene-row-${name}`)
      .getByTestId('scene-thumb')
      .getAttribute('src')
    expect(src).toMatch(/^data:image\/png;base64,/)
    return src ?? ''
  }

  async verifySceneThumbnail(name: string): Promise<void> {
    await this.sceneThumbnail(name)
  }

  async renameScene(from: string, to: string): Promise<void> {
    const field = this.page.getByTestId(`scene-name-${from}`)
    await field.fill(to)
    await field.press('Enter')
  }

  /** Types into a rename field and leaves it focused — for testing what the hotkeys do mid-edit. */
  async typeInSceneName(from: string, text: string): Promise<void> {
    const field = this.page.getByTestId(`scene-name-${from}`)
    await field.fill(text)
  }

  /** One click arms, the second deletes — the required confirm (spec §9). */
  async deleteScene(name: string): Promise<void> {
    const button = this.page.getByTestId(`scene-delete-${name}`)
    await button.click()
    await expect(button).toHaveText(/sure/)
    await button.click()
  }

  async sceneStatus(): Promise<string> {
    return this.statusText('scenes-status')
  }

  /** The scene name shown in the header. */
  async headerSceneName(): Promise<string> {
    return this.statusText('scene-name')
  }

  async statusText(testId: string): Promise<string> {
    return (await this.page.getByTestId(testId).textContent()) ?? ''
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key)
  }

  /** Paints one cell via real pointer events dispatched at the canvas — no seam bypass. */
  async paintCell(x: number, y: number): Promise<void> {
    const { clientX, clientY } = await this.canvasClientPoint(x, y)
    await this.canvas.dispatchEvent('pointerdown', { clientX, clientY, bubbles: true })
    await this.canvas.dispatchEvent('pointerup', { clientX, clientY, bubbles: true })
  }

  /** Drags from one cell to another delivered as a single pointermove — the
   * event pattern of a fast flick, where samples land many cells apart. */
  async dragPaint(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    const start = await this.canvasClientPoint(from.x, from.y)
    const end = await this.canvasClientPoint(to.x, to.y)
    await this.canvas.dispatchEvent('pointerdown', { ...start, bubbles: true })
    await this.canvas.dispatchEvent('pointermove', { ...end, bubbles: true })
    await this.canvas.dispatchEvent('pointerup', { ...end, bubbles: true })
  }

  /** Moves the pointer over a cell without pressing — drives the hover chrome. */
  async hoverCell(x: number, y: number): Promise<void> {
    const { clientX, clientY } = await this.canvasClientPoint(x, y)
    await this.canvas.dispatchEvent('pointermove', { clientX, clientY, bubbles: true })
  }

  /** Paints one cell via a real single-finger touch tap (spec §9: one finger paints). */
  async touchPaintCell(x: number, y: number): Promise<void> {
    const { clientX, clientY } = await this.canvasClientPoint(x, y)
    await this.page.touchscreen.tap(clientX, clientY)
  }

  private async canvasClientPoint(
    x: number,
    y: number,
  ): Promise<{ clientX: number; clientY: number }> {
    const point = await this.gridToCanvasPoint(x, y)
    const box = await this.canvas.boundingBox()
    if (!box) throw new Error('silt-canvas has no bounding box')
    return { clientX: box.x + point.x, clientY: box.y + point.y }
  }

  /** Mobile bottom bar (spec §9, design brief §02): step drops off. */
  async verifyStepHidden(): Promise<void> {
    await expect(this.stepButton).toBeHidden()
  }

  /** Erase belongs at the tail of the same scrollable palette row, not on a separate row. */
  async verifyEraseIsLastInPaletteRow(): Promise<void> {
    const swatchBoxes = await this.page.getByTestId(/^element-/).all()
    const eraseBox = await this.eraseButton.boundingBox()
    if (!eraseBox) throw new Error('erase-tool has no bounding box')
    for (const swatch of swatchBoxes) {
      const box = await swatch.boundingBox()
      if (!box) throw new Error('palette swatch has no bounding box')
      expect(eraseBox.x).toBeGreaterThan(box.x)
    }
  }

  /** Every paintable swatch the rail is currently rendering. */
  async paletteElementNames(): Promise<string[]> {
    const testIds = await this.page
      .getByTestId(/^element-/)
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''))
    return testIds.map((id) => id.replace('element-', ''))
  }

  /**
   * The rail overflows into its own scroller, never into the page: a bottom bar
   * that pushes the document sideways drags the canvas out of view with it.
   */
  async verifyNoHorizontalPageOverflow(): Promise<void> {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  }

  private async boundingBoxOrThrow(testId: string): Promise<{ width: number; height: number }> {
    const box = await this.page.getByTestId(testId).boundingBox()
    if (!box) throw new Error(`${testId} has no bounding box`)
    return box
  }

  /** Touch targets must be at least 44px on a side (spec §9's floor). */
  async verifyTouchTargetSize(testId: string): Promise<void> {
    const box = await this.boundingBoxOrThrow(testId)
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  /** Square icon chips (brush/swatch) are the comfortable 48x48, not just the 44px floor (spec §9). */
  async verifySquareChipSize(testId: string): Promise<void> {
    const box = await this.boundingBoxOrThrow(testId)
    expect(box.width).toBeCloseTo(48, 0)
    expect(box.height).toBeCloseTo(48, 0)
  }

  async play(): Promise<void> {
    await this.playToggle.click()
  }

  async speciesAt(x: number, y: number): Promise<number> {
    return this.canvas.evaluate(
      (el, { x, y, key }) => {
        const seam = (el as unknown as Record<string, SiltTestSeam>)[key]!
        return seam.speciesAt(x, y)
      },
      { x, y, key: TEST_SEAM_KEY },
    )
  }

  /** Which frame path the mounted app is rendering through. */
  async rendererKind(): Promise<string> {
    return this.canvas.evaluate((el, key) => {
      const seam = (el as unknown as Record<string, SiltTestSeam>)[key]!
      return seam.rendererKind()
    }, TEST_SEAM_KEY)
  }

  /** Which thread the mounted app's sim ticks on. */
  async simHostKind(): Promise<string> {
    return this.canvas.evaluate((el, key) => {
      const seam = (el as unknown as Record<string, SiltTestSeam>)[key]!
      return seam.simHostKind()
    }, TEST_SEAM_KEY)
  }

  async countSpecies(species: number): Promise<number> {
    return this.canvas.evaluate(
      (el, { species, key }) => {
        const seam = (el as unknown as Record<string, SiltTestSeam>)[key]!
        return seam.countSpecies(species)
      },
      { species, key: TEST_SEAM_KEY },
    )
  }

  async verifyCellIs(x: number, y: number, species: number): Promise<void> {
    await expect.poll(() => this.speciesAt(x, y)).toBe(species)
  }

  async verifyPixelated(): Promise<void> {
    const value = await this.canvas.evaluate((el) => getComputedStyle(el).imageRendering)
    expect(value).toBe('pixelated')
  }

  private async gridToCanvasPoint(x: number, y: number): Promise<{ x: number; y: number }> {
    return this.canvas.evaluate(
      (el, { x, y, key }) => {
        const seam = (el as unknown as Record<string, SiltTestSeam>)[key]!
        return seam.gridToCanvasPoint(x, y)
      },
      { x, y, key: TEST_SEAM_KEY },
    )
  }
}
