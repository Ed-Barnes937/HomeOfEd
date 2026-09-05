import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Locator } from '@playwright/test'

import type { MasteryState } from '../features/fieldNotes/panelModel.ts'
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
        // The layout viewport - the frame a fixed box is laid out in - rather
        // than `viewportSize()`. Since ticket 26 the harness carries the app's
        // viewport meta so the two agree, but the layout viewport is what a
        // `position: fixed` sheet is actually measured against.
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
   * The focused element's tag chips, in the order they are drawn - in the bottom
   * band since ticket 25, above the reading line. `allTextContents`, not
   * `allInnerTexts`: the chips are uppercased in CSS, and the words the model
   * chose are what this is asserting.
   */
  async focusedNoteTags(): Promise<string[]> {
    return this.page.getByTestId('field-notes-tag').allTextContents()
  }

  /**
   * The band's stack order (ticket 25): the ring, then the chips - they describe
   * the ELEMENT - then the reading line, which describes the active SPOKE. The
   * chips left the ring's fixed px offset to get here, so what this replaces is
   * the old "are they clear of a spoke tile" check: nothing of the band is on
   * the ring at all now.
   */
  async verifyBottomBandOrder(): Promise<void> {
    // The chips are out of the ring altogether, which is the move itself: they
    // used to hang off the centre at a fixed px offset. Containment rather than
    // geometry, because the ring is bigger than the box that scrolls it.
    await expect(
      this.page.locator('[data-testid="field-notes-ring"] [data-testid="field-notes-tag"]'),
    ).toHaveCount(0)
    await expect(this.page.getByTestId('field-notes-band').getByTestId('field-notes-tag').first()).toBeVisible()

    const chip = await this.page.getByTestId('field-notes-tag').first().boundingBox()
    const line = await this.page.getByTestId('field-notes-reading').boundingBox()
    expect(chip).not.toBeNull()
    expect(line).not.toBeNull()
    if (!chip || !line) return

    expect(line.y).toBeGreaterThanOrEqual(chip.y + chip.height)
  }

  /**
   * Ticket 21: the phone sheet capped the ring at 340px whatever the phone, so
   * a 390px screen drew a small circle in a wide sheet. Asserts the ring takes
   * essentially the width of the screen, and that it is still square - the
   * SVG's 0-100 box and the absolutely positioned tiles share one coordinate
   * system, so an oblong ring would draw the lines and the tiles apart.
   */
  async verifyRingFillsTheSheet(fraction: number): Promise<void> {
    const ring = await this.ringBox()
    // The sheet's own width, not `viewportSize()`. Since ticket 26 the harness
    // carries the app's viewport meta, so the two agree on a phone - but the
    // layout width is still the honest thing to measure a fluid property
    // against: the ring takes the sheet it is given, at whatever width that is.
    const sheet = await this.page.evaluate(() => document.documentElement.clientWidth)

    expect(ring.width).toBeGreaterThanOrEqual(sheet * fraction)
    await this.verifyRingIsSquare()
  }

  /**
   * The 0-100 box the SVG and the absolutely positioned tiles share: an oblong
   * ring would draw the lines and the tiles in different places, which is why
   * the sheet's ring is sized as a square and not as a width with a height.
   */
  async verifyRingIsSquare(): Promise<void> {
    const ring = await this.ringBox()
    expect(Math.abs(ring.width - ring.height)).toBeLessThanOrEqual(1)
  }

  /**
   * The other half of the sheet's sizing (ticket 21): a ring taking the width
   * of a short sheet would run into the footer, so it gives up width instead.
   * Measured against `field-notes-seen`, the footer band's own text.
   */
  async verifyRingFitsAboveTheFooter(): Promise<void> {
    const ring = await this.ringBox()
    const foot = await this.page.getByTestId('field-notes-seen').boundingBox()
    if (!foot) throw new Error('field-notes-seen has no bounding box')
    expect(ring.y + ring.height).toBeLessThanOrEqual(foot.y + 1)
  }

  /**
   * The other side of the floor, and the reason it is worth asserting: a case
   * written for a ring that *shrank* to fit its height says nothing once the
   * layout drifts far enough for the ring to sit on its floor instead, because
   * a floored ring is narrower than the sheet too. Pinning it above the floor
   * is what keeps that case about shrinking (ticket 26).
   */
  async verifyRingIsAboveItsFloor(floorPx: number): Promise<void> {
    const ring = await this.ringBox()
    expect(ring.width).toBeGreaterThan(floorPx + 1)
  }

  /**
   * The ring's floor (`ringGeometry.RING_MIN_PX`): below it the fixed-size
   * tiles would overlap, so a sheet with less room than that gets a ring at the
   * floor and a scroll, not a smaller ring (ticket 21).
   */
  async verifyRingIsAtItsFloor(floorPx: number): Promise<void> {
    const ring = await this.ringBox()
    expect(Math.abs(ring.width - floorPx)).toBeLessThanOrEqual(1)
    await this.verifyRingIsSquare()
  }

  /**
   * ...and that it really was the height that held it back, rather than the
   * test having found room for the full width after all: a ring narrower than
   * the sheet can only be the height branch of its size (ticket 21).
   */
  async verifyRingGaveUpWidthForHeight(): Promise<void> {
    const ring = await this.ringBox()
    const sheet = await this.page.evaluate(() => document.documentElement.clientWidth)
    expect(ring.width).toBeLessThan(sheet)
  }

  /**
   * Ticket 21: on a phone the focused element is named in a band above the
   * ring rather than in its centre, which is where Ed could not read it.
   */
  async verifyFocusedNameIsAboveTheRing(name: string): Promise<void> {
    const label = this.page.getByTestId('field-notes-centre')
    await expect(label).toBeVisible()
    await expect(label).toHaveText(name)

    const box = await label.boundingBox()
    if (!box) throw new Error('field-notes-centre has no bounding box')
    const ring = await this.ringBox()
    expect(box.y + box.height).toBeLessThanOrEqual(ring.y + 1)
  }

  /**
   * The ring's tiles keep clear of each other at whatever size the ring is
   * drawn: the geometry is proportional, so a bigger ring should hold this by
   * construction - which is worth pinning rather than assuming (ticket 21).
   */
  async verifyRingTilesDoNotOverlap(): Promise<void> {
    const tiles = await this.page
      .getByTestId(/^field-notes-spoke-/)
      .all()
      .then((all) => Promise.all(all.map((tile) => tile.boundingBox())))

    expect(tiles.length).toBeGreaterThan(1)
    for (let i = 0; i < tiles.length; i += 1) {
      for (let j = i + 1; j < tiles.length; j += 1) {
        const a = tiles[i]
        const b = tiles[j]
        if (!a || !b) continue
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y
        expect(apart).toBe(true)
      }
    }
  }

  private async ringBox(): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await this.page.getByTestId('field-notes-ring').boundingBox()
    if (!box) throw new Error('field-notes-ring has no bounding box')
    return box
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

  /**
   * The drawn star after an element's name (spec §6), asserted through the words
   * a screen reader gets rather than the fill a sighted player reads: `mastered`
   * is filled, `partial` is the hollow one ticket 18 added, `none` is no star at
   * all. One helper for the three, over the model's own `MasteryState`, so a
   * fourth state cannot reach one side only - and so a case cannot assert the
   * absence of one star while another is sitting there.
   */
  async verifyNoteStar(name: string, state: MasteryState): Promise<void> {
    await this.verifyStarIn(this.page.getByTestId(`field-notes-row-${name}`), state)
  }

  /**
   * The same star beside the focused element's name in the ring (desktop; the
   * phone's band is ticket 21's move of the same node). Its own assertion
   * because the design's rule is "where a star renders, the state renders":
   * a row and a centre that disagreed would be the bug.
   */
  async verifyFocusedNoteStar(state: MasteryState): Promise<void> {
    await this.verifyStarIn(this.page.getByTestId('field-notes-ring'), state)
  }

  /** Both star sites, asserted the same way: the words, and the absence of the other. */
  private async verifyStarIn(within: Locator, state: MasteryState): Promise<void> {
    await expect(within.getByLabel('mastered', { exact: true })).toHaveCount(
      state === 'mastered' ? 1 : 0,
    )
    await expect(within.getByLabel('more to see here', { exact: true })).toHaveCount(
      state === 'partial' ? 1 : 0,
    )
  }

  /** An undiscovered element keeps its slot but is not a control (spec §7). */
  async verifyNoteRowIsInert(name: string): Promise<void> {
    const row = this.page.getByTestId(`field-notes-row-${name}`)
    await expect(row).toBeVisible()
    await expect(row).toBeDisabled()
    await expect(row).toContainText('?')
  }

  /**
   * Follows a tile in the reading line - the way into its own entry, and since
   * ticket 25 the only way: the ring's own tiles select into the band instead.
   * The first of them, because a recipe can name one element twice.
   */
  async followReadingTile(name: string): Promise<void> {
    await this.page.getByTestId(`field-notes-reading-${name}`).first().click()
  }

  /**
   * Taps an element on the ring, which reads its spoke into the band (ticket
   * 25) rather than navigating. The first of them: a ring can draw one element
   * on several spokes - and, since ticket 09, in several stacks.
   */
  async readSpoke(name: string): Promise<void> {
    await this.page.getByTestId(`field-notes-spoke-${name}`).first().click()
  }

  /** The desktop's other two ways into the band: the pointer, and the tab key. */
  async hoverSpoke(name: string): Promise<void> {
    await this.page.getByTestId(`field-notes-spoke-${name}`).first().hover()
  }

  async focusSpoke(name: string): Promise<void> {
    const tile = this.page.getByTestId(`field-notes-spoke-${name}`).first()
    await tile.focus()
    // Proof it is really focusable rather than merely asked to be: a disabled
    // or `tabindex=-1` tile would take no focus, and a keyboard could never
    // reach the reading line at all.
    await expect(tile).toBeFocused()
  }

  /**
   * What the reading line says: the active spoke's recipe, or the hint. Every
   * word of it is masked by `panelModel`, which is what makes this the one text
   * site the spoiler policy has to hold (ticket 25).
   */
  async readingLine(): Promise<string> {
    return (await this.page.getByTestId('field-notes-reading').innerText()) ?? ''
  }

  /**
   * The tiles the reading line offers to follow, in the order it draws them.
   * Every id under `field-notes-reading-` is an element: the group chip has an
   * id of its own, so no name has to be filtered back out of the namespace.
   */
  async readingLineTiles(): Promise<string[]> {
    const tiles = await this.page.getByTestId(/^field-notes-reading-/).all()
    const ids = await Promise.all(tiles.map((tile) => tile.getAttribute('data-testid')))
    return ids.flatMap((id) => (id ? [id.replace('field-notes-reading-', '')] : []))
  }

  /** A long recipe scrolls inside the band rather than widening the panel. */
  async verifyReadingLineFitsThePanel(): Promise<void> {
    const line = await this.page.getByTestId('field-notes-reading').boundingBox()
    const panel = await this.notesPanel.boundingBox()
    expect(line).not.toBeNull()
    expect(panel).not.toBeNull()
    if (!line || !panel) return
    expect(line.width).toBeLessThanOrEqual(panel.width)
  }

  /**
   * The band's height, which must not move between the hint and a full recipe -
   * a band that grew as a spoke was read would jump the ring above it.
   */
  async readingBandHeight(): Promise<number> {
    const box = await this.page.getByTestId('field-notes-band').boundingBox()
    expect(box).not.toBeNull()
    return box?.height ?? 0
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

  /** The reading line's own `2/5` chip, when the spoke it holds is a merged one. */
  async readingLineCount(): Promise<string> {
    const chip = this.page.getByTestId('field-notes-line-count')
    return (await chip.count()) === 0 ? '' : ((await chip.textContent()) ?? '')
  }

  async noteStillToFind(): Promise<string> {
    return this.statusText('field-notes-still-to-find')
  }

  /** Opens or closes the footer's key - the line kinds the ring draws (ticket 11). */
  async toggleFieldNotesKey(): Promise<void> {
    await this.page.getByTestId('field-notes-key-toggle').click()
  }

  /**
   * What the key's toggle actually reads on screen. `innerText`, not
   * `textContent`: the chrome uppercases its Silkscreen labels in CSS, so the
   * case in the source is not what the player sees - asserting the source's
   * "Key" would be asserting a word nobody reads.
   */
  async fieldNotesKeyToggleText(): Promise<string> {
    return (await this.page.getByTestId('field-notes-key-toggle').innerText()) ?? ''
  }

  /**
   * Ticket 22's thesis, as one measurement: the explanatory control is no longer
   * sized by the destructive footnote beside it. The two shared a CSS rule, and
   * `forget discoveries` - the one you should have to look for - set the 8px
   * both were drawn at.
   */
  async verifyFieldNotesKeyToggleOutsizesForget(): Promise<void> {
    const key = await this.boundingBoxOrThrow('field-notes-key-toggle')
    const forget = await this.boundingBoxOrThrow('field-notes-forget')
    expect(key.height).toBeGreaterThan(forget.height)
  }

  /**
   * Ticket 22, half one: the key is on the screen the ring is on, with nothing
   * to scroll to reach it. Read off the live box from inside the page - a
   * viewport comparison has to be made in the frame the layout was done in,
   * which under Playwright's mobile emulation is not `viewportSize()`.
   */
  async verifyFieldNotesKeyToggleIsOnScreen(): Promise<void> {
    const placement = await this.page.evaluate(() => {
      const toggle = document
        .querySelector('[data-testid="field-notes-key-toggle"]')
        ?.getBoundingClientRect()
      if (!toggle) throw new Error('the key toggle is not shown')

      return {
        drawn: toggle.width > 0 && toggle.height > 0,
        inTheViewport:
          toggle.top >= 0 &&
          toggle.left >= 0 &&
          toggle.right <= window.innerWidth &&
          toggle.bottom <= window.innerHeight,
      }
    })

    expect(placement).toEqual({ drawn: true, inTheViewport: true })
  }

  /**
   * Ticket 22, half two, and the regression the finding was actually about: the
   * key leads the footer's controls rather than trailing a tail of up to
   * twenty-two still-to-find notches, which is where it was when the person who
   * asked for a key could not find one. "Leads" is reading order, not just x:
   * the phone's footer wraps, and a toggle that dropped to the line *below* the
   * counter would still be to its left while failing the whole point.
   */
  async verifyFieldNotesKeyToggleLeadsTheFooter(): Promise<void> {
    const lead = await this.page.evaluate(() => {
      const toggle = document
        .querySelector('[data-testid="field-notes-key-toggle"]')
        ?.getBoundingClientRect()
      const stillToFind = document
        .querySelector('[data-testid="field-notes-still-to-find"]')
        ?.getBoundingClientRect()
      if (!toggle || !stillToFind) throw new Error('the ring footer is not shown')

      return {
        // Not on a later wrapped line: the two overlap vertically, or the
        // toggle sits above.
        notWrappedBelow: toggle.top < stillToFind.bottom,
        aheadOfTheNotches: toggle.left < stillToFind.left,
      }
    })

    expect(lead).toEqual({ notWrappedBelow: true, aheadOfTheNotches: true })
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
