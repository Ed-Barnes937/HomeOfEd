import { BasePage } from '@hoe/test-kit'
import type { Locator } from '@playwright/test'
import { expect } from '@playwright/experimental-ct-react'

import type { PlayedSample } from '../engine/testing/fakeAudioDriver.ts'
import { parseSaveDocument, type StoredBoop } from '../persistence/saveFormat.ts'
import { SAVE_KEY } from '../persistence/storage.ts'
import { BOOP_AUDIO_DRIVER_KEY } from './gridProtocol.ts'

/** How far `crankSteps` moves the fake clock per step — clear of the 0.1s lookahead, so each step's draw releases in the same iteration. */
export const CRANK_STEP_SECONDS = 0.2

/** The root page object for boop's grid app — tap cells, play/pause, and drive the fake audio clock. */
export class HomePagePom extends BasePage {
  private readonly playButton = this.page.getByTestId('play-button')
  private readonly tempoSlider = this.page.getByTestId('tempo-slider')
  private readonly tempoReadout = this.page.getByTestId('tempo-readout')
  private readonly clearGridButton = this.page.getByTestId('clear-grid-button')
  private readonly confirmSafeButton = this.page.getByTestId('confirm-safe-button')
  private readonly confirmDestructiveButton = this.page.getByTestId('confirm-destructive-button')
  private readonly shareButton = this.page.getByTestId('share-button')
  private readonly boopsButton = this.page.getByTestId('boops-button')
  private readonly saveBoopButton = this.page.getByTestId('save-boop-button')
  private readonly saveNameInput = this.page.getByTestId('boop-save-name-input')
  private readonly boopsCloseButton = this.page.getByTestId('boops-close-button')
  private readonly boopsCard = this.page.getByRole('dialog', { name: 'My boops' })
  private readonly boopsList = this.page.getByTestId('boops-list')
  private readonly helpButton = this.page.getByTestId('help-button')
  private readonly hintSheet = this.page.getByTestId('hint-sheet')
  private readonly hintSheetOverlay = this.page.getByTestId('hint-sheet-overlay')
  private readonly hintSheetClose = this.page.getByTestId('hint-sheet-close')

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByText('boop', { exact: true })).toBeVisible()
    // Named: the laptop layout has a second application region (the song lanes).
    await expect(this.page.getByRole('application', { name: /step grid/ })).toBeVisible()
  }

  cell(instrumentId: string, step: number) {
    return this.page.getByTestId(`cell-${instrumentId}-${step}`)
  }

  async toggleCell(instrumentId: string, step: number): Promise<void> {
    await this.cell(instrumentId, step).click()
  }

  /**
   * Drag-paint across a run of steps on one row, real mouse-down/move/up so
   * the browser generates the pointerdown/pointerenter sequence the grid's
   * latched drag-paint listens for — pointer-down on `steps[0]` decides
   * add-or-remove, then every later step in `steps` gets that same decision.
   */
  async dragPaint(instrumentId: string, steps: number[]): Promise<void> {
    const [first, ...rest] = steps
    if (first === undefined) return
    // The rows scroll inside the well (ticket 23), so the row being painted may
    // be below its visible band — a real finger scrolls to it first.
    await this.cell(instrumentId, first).scrollIntoViewIfNeeded()
    const startBox = await this.cell(instrumentId, first).boundingBox()
    if (!startBox) throw new Error(`cell ${instrumentId}-${first} is not visible`)
    await this.page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2)
    await this.page.mouse.down()
    for (const step of rest) {
      const box = await this.cell(instrumentId, step).boundingBox()
      if (!box) throw new Error(`cell ${instrumentId}-${step} is not visible`)
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    }
    await this.page.mouse.up()
  }

  /** Toggle a cell the keyboard way — focus it, then Enter (spec: "Accessibility & input"). */
  async toggleCellWithKeyboard(instrumentId: string, step: number): Promise<void> {
    await this.cell(instrumentId, step).focus()
    await this.page.keyboard.press('Enter')
  }

  async focusCell(instrumentId: string, step: number): Promise<void> {
    await this.cell(instrumentId, step).focus()
  }

  async verifyCellFocused(instrumentId: string, step: number): Promise<void> {
    await expect(this.cell(instrumentId, step)).toBeFocused()
  }

  /** Arrow-key grid navigation (spec: "Accessibility & input") — moves the focused cell. */
  async pressArrowKey(key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): Promise<void> {
    await this.page.keyboard.press(key)
  }

  /** Backspace removes the focused cell, distinct from Enter's toggle. */
  async pressBackspace(): Promise<void> {
    await this.page.keyboard.press('Backspace')
  }

  async focusClearGridButton(): Promise<void> {
    await this.clearGridButton.focus()
  }

  /** Spacebar toggles play globally (spec: "Transport & tempo"). */
  async pressSpaceKey(): Promise<void> {
    await this.page.keyboard.press('Space')
  }

  /** The name in the save form's field — always the name the next save will write (ticket 32). */
  async readBoopSaveNameFieldValue(): Promise<string> {
    return this.saveNameInput.inputValue()
  }

  async openClearGridConfirm(): Promise<void> {
    await this.clearGridButton.click()
  }

  async verifyClearGridConfirmShown(): Promise<void> {
    await expect(this.page.getByText('Clear the whole grid?')).toBeVisible()
  }

  async keepPlaying(): Promise<void> {
    await this.confirmSafeButton.click()
  }

  async clearIt(): Promise<void> {
    await this.confirmDestructiveButton.click()
  }

  // --- New boop (the plain reset) and the "+ New clip" picker (ticket 17) ---

  private readonly newBoopButton = this.page.getByTestId('new-boop-button')
  private readonly pickerDialog = this.page.getByRole('dialog', { name: 'New clip' })

  pickerCard(sampleId: string) {
    return this.page.getByTestId(`picker-card-${sampleId}`)
  }

  /** Tap "+ New clip" and wait for the picker dialog. */
  async openNewClipPicker(): Promise<void> {
    await this.page.getByTestId('new-clip-button').click()
    await expect(this.pickerDialog).toBeVisible()
  }

  /** Pick a card from the open picker — `'blank'` or a sample clip's id. It closes itself. */
  async pickClip(sampleId: string): Promise<void> {
    await this.pickerCard(sampleId).click()
    await this.verifyPickerClosed()
  }

  async closeNewClipPicker(): Promise<void> {
    await this.page.getByTestId('new-clip-close-button').click()
  }

  /** Tap the dimmed backdrop, outside the picker's card — the touch-easy dismiss. */
  async dismissPickerByOutsideTap(): Promise<void> {
    await this.page.mouse.click(4, 4)
  }

  async verifyPickerShown(): Promise<void> {
    await expect(this.pickerDialog).toBeVisible()
  }

  async verifyPickerClosed(): Promise<void> {
    await expect(this.pickerDialog).toHaveCount(0)
  }

  /** The picker's cards, top-left to bottom-right — the order is part of the design. */
  async verifyPickerCardOrder(expected: string[]): Promise<void> {
    await expect(
      this.page.getByTestId('picker-cards').getByRole('button'),
    ).toHaveText(expected)
  }

  /** No dialog of any kind is open — New boop is a plain reset, not a picker. */
  async verifyNoDialogOpen(): Promise<void> {
    await expect(this.page.getByRole('dialog')).toHaveCount(0)
  }

  /**
   * Start from an empty grid, the way a child would. A fresh browser is seeded
   * with a sample clip (tickets 36/17), so a suite that is about grid
   * behaviour rather than onboarding has to say where it starts. New boop is
   * a plain one-tap reset at every width (spec §7).
   */
  async startBlank(): Promise<void> {
    await this.newBoopButton.click()
  }

  async verifyCellOn(instrumentId: string, step: number): Promise<void> {
    await expect(this.cell(instrumentId, step)).toHaveAttribute('data-active', 'true')
  }

  async verifyCellOff(instrumentId: string, step: number): Promise<void> {
    await expect(this.cell(instrumentId, step)).toHaveAttribute('data-active', 'false')
  }

  async pressPlay(): Promise<void> {
    await this.playButton.click()
  }

  async verifyPlaying(): Promise<void> {
    await expect(this.playButton).toHaveAttribute('aria-pressed', 'true')
  }

  async verifyPaused(): Promise<void> {
    await expect(this.playButton).toHaveAttribute('aria-pressed', 'false')
  }

  /** Drag the tempo slider to a given position on its 0–100 percent track. */
  async setTempoPercent(percent: number): Promise<void> {
    await this.tempoSlider.fill(String(percent))
  }

  async verifyTempo(bpm: number): Promise<void> {
    await expect(this.tempoReadout).toHaveText(`${bpm} BPM`)
  }

  /** Fire one scheduled step on the in-page FakeAudioDriver's hand-cranked clock. */
  async fireStep(): Promise<void> {
    await this.page.evaluate((key) => {
      const driver = (globalThis as unknown as Record<string, { fireStep: () => void }>)[key]!
      driver.fireStep()
    }, BOOP_AUDIO_DRIVER_KEY)
  }

  /**
   * Move the fake driver's audio clock forward to a given time, releasing any
   * due draws — the draw-time channel (`onDrawBeat`) only fires once the
   * clock reaches a scheduled step's `audioTime`, unlike `fireStep` which
   * only queues it.
   */
  async advanceDrawClock(audioTime: number): Promise<void> {
    await this.page.evaluate(
      ({ key, audioTime: time }) => {
        const driver = (globalThis as unknown as Record<string, { advanceTo: (time: number) => void }>)[key]!
        driver.advanceTo(time)
      },
      { key: BOOP_AUDIO_DRIVER_KEY, audioTime },
    )
  }

  playhead() {
    return this.page.getByTestId('playhead')
  }

  async verifyPlayheadAtStep(step: number): Promise<void> {
    await expect(this.playhead()).toHaveAttribute('data-step', String(step))
  }

  async verifyPlayheadHidden(): Promise<void> {
    await expect(this.playhead()).toHaveCount(0)
  }

  async verifyActiveBar(bar: number): Promise<void> {
    await expect(this.page.getByTestId(`bar-numeral-${bar}`)).toHaveAttribute('data-active', 'true')
  }

  async verifyCellStruck(instrumentId: string, step: number): Promise<void> {
    await expect(this.page.getByTestId(`cell-squash-${instrumentId}-${step}`)).toHaveAttribute(
      'data-struck',
      'true',
    )
  }

  async verifyRowLabelStruck(instrumentId: string): Promise<void> {
    await expect(this.page.getByTestId(`row-label-${instrumentId}`)).toHaveAttribute('data-struck', 'true')
  }

  /** The autosaved working grid a reload would restore from, or `null`. */
  async readAutosavedGrid(): Promise<StoredBoop | null> {
    const raw = await this.page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY)
    return parseSaveDocument(raw).working
  }

  /** The "My boops" list — separate from the working grid a load may replace. */
  async readSavedBoops(): Promise<readonly StoredBoop[]> {
    const raw = await this.page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY)
    return parseSaveDocument(raw).creations
  }

  /**
   * Wait for the debounced autosave to reach localStorage with a given cell on
   * — asserting on content, not merely on the slot existing, so the wait cannot
   * be satisfied by an earlier write of a grid that predates the edit. `clip`
   * says which clip of the working song the cell belongs to (ticket 14).
   */
  async waitForAutosavedCell(instrumentId: string, step: number, clip = 0): Promise<void> {
    await expect
      .poll(async () => {
        const working = await this.readAutosavedGrid()
        const row = working?.patterns[clip]?.rows.find((r) => r.instrumentId === instrumentId)
        return row?.steps[step] === '1'
      })
      .toBe(true)
  }

  async pressShare(): Promise<void> {
    await this.shareButton.click()
  }

  /** The desktop share path flips the one button's label; there is no toast. */
  async verifyShareCopied(): Promise<void> {
    await expect(this.shareButton).toHaveText('Copied!')
  }

  async verifyShareResting(): Promise<void> {
    await expect(this.shareButton).toHaveText('Share')
  }

  /** The link the Share button put on the clipboard. */
  async readCopiedShareLink(): Promise<string> {
    return this.page.evaluate(() => navigator.clipboard.readText())
  }

  /**
   * Forget the autosaved grid — a fresh visitor's browser. Only meaningful
   * between a reload and the next mount: an app that is still mounted flushes
   * its pending autosave back on the way out.
   */
  async clearSavedState(): Promise<void> {
    await this.page.evaluate((key) => window.localStorage.removeItem(key), SAVE_KEY)
  }

  /** Open a share link in this page: set its fragment, then reload onto it. */
  async openShareLink(url: string): Promise<void> {
    const { hash } = new URL(url)
    await this.page.evaluate((fragment) => {
      window.location.hash = fragment
    }, hash)
    await this.page.reload()
  }

  async openBoops(): Promise<void> {
    await this.boopsButton.click()
  }

  async closeBoops(): Promise<void> {
    await this.boopsCloseButton.click()
  }

  /**
   * Presses "Save this boop" and returns the name that was written — the value
   * that was in the field at the moment of the press (ticket 32: the box always
   * holds the name the save will use).
   */
  async saveBoop(): Promise<string> {
    const name = await this.saveNameInput.inputValue()
    await this.saveBoopButton.click()
    return name
  }

  /** Two presses inside one task — the impatient child the whole ticket is about. */
  async doublePressSave(): Promise<void> {
    await doubleClickInOneTask(this.saveBoopButton)
  }

  /** Overtype the prefilled name before saving. */
  async typeSaveName(name: string): Promise<void> {
    await this.saveNameInput.fill(name)
  }

  /** Enter inside the name field saves, without reaching for the button. */
  async pressEnterInSaveName(): Promise<void> {
    await this.saveNameInput.press('Enter')
  }

  async verifySaveNameFieldFocused(): Promise<void> {
    await expect(this.saveNameInput).toBeFocused()
  }

  async verifySaveNameFieldNotFocused(): Promise<void> {
    await expect(this.saveNameInput).not.toBeFocused()
  }

  async verifySaveDisabled(): Promise<void> {
    await expect(this.saveBoopButton).toBeDisabled()
  }

  async verifySaveEnabled(): Promise<void> {
    await expect(this.saveBoopButton).toBeEnabled()
  }

  /**
   * The row sits inside the scrolled list, not above or below its fold. Not a
   * whole 1.0: the just-saved row's `boopPop` scales it a little past its own
   * box mid-animation.
   */
  async verifyBoopRowInView(index: number): Promise<void> {
    await expect(this.boopRow(index)).toBeInViewport({ ratio: 0.9 })
  }

  /** The brief just-saved highlight on the new row (ticket 32). */
  async verifyBoopHighlighted(index: number): Promise<void> {
    await expect(this.boopRow(index)).toHaveAttribute('data-highlighted', 'true')
  }

  boopExportButton(index: number) {
    return this.page.getByTestId(`boop-export-button-${index}`)
  }

  /** Export that saved boop as a WAV — the only export path (ticket 34). */
  async exportBoop(index: number): Promise<void> {
    await this.boopExportButton(index).click()
  }

  async verifyBoopExportEnabled(index: number): Promise<void> {
    await expect(this.boopExportButton(index)).toBeEnabled()
  }

  /**
   * Two taps inside one task — the impatient double-tap. React has not
   * re-rendered the button as disabled between them, so this exercises the
   * guard itself rather than the disabled attribute.
   */
  async doubleTapExport(index: number): Promise<void> {
    await doubleClickInOneTask(this.boopExportButton(index))
  }

  /**
   * The card grows with its content and stops at the viewport minus the 16px
   * gutters — width clamped to 560px, height to `100vh - 64px` (ticket 30).
   */
  async readBoopsCardSize(): Promise<{ width: number; height: number }> {
    const box = await this.boopsCard.boundingBox()
    if (!box) throw new Error('the "My boops" card is not visible')
    return { width: box.width, height: box.height }
  }

  /** Only the list scrolls: the card itself never has content hidden above the title. */
  async verifyBoopsListIsTheScroller(): Promise<void> {
    const list = await this.boopsList.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }))
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)

    const card = await this.boopsCard.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }))
    expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight + 1)
  }

  /** Nothing in the card — the save form included — spills out sideways. */
  async verifyBoopsCardHasNoOverflow(): Promise<void> {
    const overflow = await this.boopsCard.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  }

  async verifyBoopsTitleVisible(): Promise<void> {
    await expect(this.boopsCard.getByText('My boops', { exact: true })).toBeInViewport()
  }

  boopRow(index: number) {
    return this.page.getByTestId(`boop-row-${index}`)
  }

  // --- The saved/edited indicator (ticket 31) ---

  /** The whole of the desktop indicator's text — `Boop 1`, `Boop 1 • edited`, or `Not saved yet`. */
  async verifySavedState(text: string): Promise<void> {
    await expect(this.page.getByTestId('saved-state')).toHaveText(text)
  }

  /** The phone's dot badge: filled when this grid is not a row in "My boops", hollow when it is. */
  async verifyPhoneSavedDot(unsaved: boolean): Promise<void> {
    await expect(this.page.getByTestId('phone-saved-dot')).toHaveAttribute(
      'data-unsaved',
      String(unsaved),
    )
  }

  /** The standing "this is the one you're playing" ring on a row (handoff §4). */
  async verifyBoopRowLoaded(index: number): Promise<void> {
    await expect(this.boopRow(index)).toHaveAttribute('data-loaded', 'true')
  }

  async verifyBoopRowNotLoaded(index: number): Promise<void> {
    await expect(this.boopRow(index)).toHaveAttribute('data-loaded', 'false')
  }

  /**
   * Closing the tab raises no browser confirm (ticket 31, decision 5). Covers
   * both ways of asking for one: a listener that cancels a real `beforeunload`
   * — what the browser itself checks — and the legacy `window.onbeforeunload`
   * property, whose returned string prompts without ever cancelling.
   */
  async verifyNoUnloadPrompt(): Promise<void> {
    const asked = await this.page.evaluate(() => ({
      cancelled: !window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
      legacyHandler: window.onbeforeunload !== null,
    }))
    expect(asked).toEqual({ cancelled: false, legacyHandler: false })
  }

  async loadBoop(index: number): Promise<void> {
    await this.page.getByTestId(`boop-load-${index}`).click()
  }

  async verifyBoopName(index: number, name: string): Promise<void> {
    await expect(this.boopRow(index)).toContainText(name)
  }

  async verifyBoopCount(count: number): Promise<void> {
    await expect(this.page.getByTestId(/^boop-row-\d+$/)).toHaveCount(count)
  }

  async renameBoop(index: number, name: string): Promise<void> {
    await this.page.getByTestId(`boop-rename-button-${index}`).click()
    const input = this.page.getByTestId(`boop-rename-${index}-input`)
    await input.fill(name)
    await this.page.getByTestId(`boop-rename-${index}-done`).click()
  }

  async openDeleteBoopConfirm(index: number): Promise<void> {
    await this.page.getByTestId(`boop-delete-button-${index}`).click()
  }

  async verifyDeleteBoopConfirmShown(name: string): Promise<void> {
    await expect(this.page.getByText(`Throw away ${name}?`)).toBeVisible()
  }

  async openHints(): Promise<void> {
    await this.helpButton.click()
  }

  async closeHints(): Promise<void> {
    await this.hintSheetClose.click()
  }

  /** Tap the dimmed backdrop, outside the sheet's card — the touch-easy dismiss. */
  async dismissHintsByOutsideTap(): Promise<void> {
    await this.hintSheetOverlay.click({ position: { x: 4, y: 4 } })
  }

  async dismissHintsByEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
  }

  async verifyHintSheetShown(): Promise<void> {
    await expect(this.hintSheet).toBeVisible()
  }

  async verifyHintSheetHidden(): Promise<void> {
    await expect(this.hintSheet).toHaveCount(0)
  }

  // --- Small-phone layout (ticket 27) ---

  private readonly phoneMenuButton = this.page.getByTestId('phone-menu-button')

  stepWindow() {
    return this.page.getByTestId('phone-step-window')
  }

  async verifyPhoneChromeShown(): Promise<void> {
    await expect(this.page.getByTestId('phone-bar')).toBeVisible()
    // The desktop chrome's ghost/primary buttons are simply not mounted.
    await expect(this.page.getByRole('button', { name: 'My boops' })).toHaveCount(0)
  }

  async openPhoneMenu(): Promise<void> {
    await this.phoneMenuButton.click()
    await expect(this.page.getByTestId('phone-menu')).toBeVisible()
  }

  /** The "⋯" menu's entries, top to bottom — the order is part of the design. */
  async verifyPhoneMenuItems(expected: string[]): Promise<void> {
    await expect(this.page.getByTestId('phone-menu').getByRole('button')).toHaveText(expected)
  }

  /**
   * Every tap target in the phone chrome clears 44px (design handoff, "Tap
   * targets"). Grid cells are excluded by design — see the handoff's note on
   * the 32 x 44 phone cell.
   */
  async verifyPhoneChromeTapTargets(): Promise<void> {
    const boxes = await this.page
      .getByTestId('phone-bar')
      .locator('a, button')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const { width, height } = element.getBoundingClientRect()
          return { width, height }
        }),
      )
    expect(boxes.length).toBeGreaterThan(0)
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  }

  async readStepWindowScroll(): Promise<number> {
    return this.stepWindow().evaluate((element) => element.scrollLeft)
  }

  /** A real sideways swipe over the step window — the browser owns the pan. */
  async swipeSteps(deltaX: number): Promise<void> {
    // The window is taller than the well's scroll box shows (ticket 23), so its
    // centre can be off the visible band and the wheel would land elsewhere.
    // Aim at the middle of the part a child can actually see, and scroll
    // nothing to get there — the swipe must start from where the strip is.
    const point = await this.stepWindow().evaluate((element) => {
      const window_ = element.getBoundingClientRect()
      const box = element.closest('[data-testid="grid-scroll"]')?.getBoundingClientRect()
      const top = Math.max(window_.top, box?.top ?? window_.top)
      const bottom = Math.min(window_.bottom, box?.bottom ?? window_.bottom)
      return { x: window_.left + window_.width / 2, y: (top + bottom) / 2 }
    })
    await this.page.mouse.move(point.x, point.y)
    await this.page.mouse.wheel(deltaX, 0)
  }

  /** Wait for the snap to settle on a bar line at the given strip offset. */
  async verifyStepWindowAt(offset: number): Promise<void> {
    await expect.poll(async () => this.readStepWindowScroll()).toBe(offset)
  }

  async verifyLoopTick(step: number, state: 'playhead' | 'note' | 'empty'): Promise<void> {
    await expect(this.page.getByTestId(`loop-tick-${step}`)).toHaveAttribute('data-state', state)
  }

  /** All 16 ticks are always drawn — that is what keeps the playhead findable. */
  async verifyLoopMapCoversWholeLoop(): Promise<void> {
    await expect(this.page.getByTestId('loop-map').locator('[data-state]')).toHaveCount(16)
  }

  /**
   * Where the window bracket sits under the loop map, as a percentage of the
   * map's width. The bracket is always a fixed half-loop wide; only its offset
   * moves, so that is the one number worth asserting.
   */
  async verifyLoopWindowBracketAt(leftPercent: number): Promise<void> {
    await expect
      .poll(async () =>
        this.page
          .getByTestId('loop-window-bracket')
          .evaluate((element: HTMLElement) =>
            Math.round((element.offsetLeft / element.parentElement!.clientWidth) * 100),
          ),
      )
      .toBe(leftPercent)
  }

  async verifyPlayheadEdgeGlow(side: 'left' | 'right'): Promise<void> {
    await expect(this.page.getByTestId('playhead-edge-glow')).toHaveAttribute('data-side', side)
  }

  async verifyNoPlayheadEdgeGlow(): Promise<void> {
    await expect(this.page.getByTestId('playhead-edge-glow')).toHaveCount(0)
  }

  /** No sideways scroll of the *page* — the step window is the only scroller. */
  async verifyNoHorizontalOverflow(): Promise<void> {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  }

  /** The chrome strip's save icon — opens "My boops" with the save form ready (ticket 32). */
  async pressPhoneSave(): Promise<void> {
    await this.page.getByTestId('phone-save-button').click()
  }

  async openBoopsFromPhoneMenu(): Promise<void> {
    await this.page.getByTestId('phone-menu-my-boops').click()
  }

  async openHintsFromPhoneMenu(): Promise<void> {
    await this.page.getByTestId('phone-menu-hints').click()
  }

  async verifyPhoneMenuClosed(): Promise<void> {
    await expect(this.page.getByTestId('phone-menu')).toHaveCount(0)
  }

  /**
   * An open overlay has to cover the 52px chrome strip, not sit under it — the
   * strip is what opens these panels, so a child who has just tapped it must
   * not still be able to tap it through the dim.
   */
  async verifyPhoneChromeCoveredByOverlay(): Promise<void> {
    const covered = await this.page.getByTestId('phone-save-button').evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      const top = document.elementFromPoint(x + width / 2, y + height / 2)
      return top === null || !element.contains(top)
    })
    expect(covered).toBe(true)
  }

  async verifyBoopsPanelShown(): Promise<void> {
    await expect(this.boopsCard).toBeVisible()
  }

  /**
   * The centring wrapper (ticket 29) leaves equal margins either side of the
   * fixed-geometry column on a wide screen, instead of pinning it to the left
   * with all the slack on the right.
   */
  async verifyStageColumnCentered(): Promise<void> {
    const box = await this.page.getByTestId('stage-column').boundingBox()
    if (!box) throw new Error('the stage column is not visible')
    const viewportWidth = this.page.viewportSize()?.width
    if (!viewportWidth) throw new Error('no viewport size')
    const leftMargin = box.x
    const rightMargin = viewportWidth - (box.x + box.width)
    expect(box.width).toBeLessThan(viewportWidth)
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(1)
  }

  // --- The fixed frame (ticket 33) ---

  private readonly stageScroller = this.page.getByTestId('stage-scroller')
  // The pinned bottom bar: the transport on the phone (<1024px), the song bar
  // at and above it (tickets 15/20). Only ever one of the two is mounted.
  private readonly transportBar = this.page
    .getByTestId('transport-bar')
    .or(this.page.getByTestId('song-bar'))

  /** Whole bar on screen, not merely intersecting it. */
  async verifyTransportFullyInViewport(): Promise<void> {
    await expect(this.transportBar).toBeInViewport({ ratio: 1 })
  }

  async verifyTopBarFullyInViewport(): Promise<void> {
    await expect(this.page.getByText('boop', { exact: true })).toBeInViewport({ ratio: 1 })
  }

  /**
   * The bar is inset to the centred column, not full-bleed — ticket 33's
   * decision 1, reversed by the layout prototype (ticket 37).
   */
  async verifyTransportInsetToColumn(): Promise<void> {
    const bar = await this.transportBar.boundingBox()
    const column = await this.page.getByTestId('stage-column').boundingBox()
    if (!bar || !column) throw new Error('the transport bar or the stage column is not visible')
    expect(Math.round(bar.x)).toBe(Math.round(column.x))
    expect(Math.round(bar.width)).toBe(Math.round(column.width))
  }

  /** Nothing inside the transport spills sideways — the phone tempo block shrinks. */
  async verifyTransportHasNoOverflow(): Promise<void> {
    const overflow = await this.transportBar.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  }

  /**
   * "Fast" clears the phone's New boop button (ticket 36, carried over from
   * 33) — the gap the shrink fix bought back, not merely the absence of an
   * overlap. Ticket 37 measured a 23px overlap at 360px; the bar's own
   * `gap: 14px` is what should separate them, so anything under 10px means the
   * tempo block has started losing the argument again.
   */
  async verifyTempoClearsNewBoopButton(): Promise<void> {
    const fast = await this.page.getByText('Fast', { exact: true }).boundingBox()
    const button = await this.newBoopButton.boundingBox()
    if (!fast || !button) throw new Error('the tempo endpoint or the New boop button is not visible')
    expect(button.x - (fast.x + fast.width)).toBeGreaterThanOrEqual(10)
  }

  /** New boop is a 44px tap target on the phone, like the rest of the chrome. */
  async verifyNewBoopButtonTapTarget(): Promise<void> {
    const box = await this.newBoopButton.boundingBox()
    if (!box) throw new Error('the New boop button is not visible')
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  /**
   * The loop map is inside the scrolling region, glued under the grid — it must
   * never migrate into the pinned bar and become a second transport (ADR 0027).
   */
  async verifyLoopMapInsideGridRegion(): Promise<void> {
    const inside = await this.page
      .getByTestId('loop-map')
      .evaluate((element, id) => element.closest(`[data-testid="${id}"]`) !== null, 'stage-scroller')
    expect(inside).toBe(true)
  }

  // --- The pinned play bars (ticket 23) ---

  private readonly gridWellScroll = this.page.getByTestId('grid-scroll')

  /** Clip play: the well's footer at ≥1024, the pinned transport on the phone. */
  async verifyClipPlayFullyInViewport(): Promise<void> {
    await expect(this.playButton).toBeInViewport({ ratio: 1 })
  }

  async verifySongPlayFullyInViewport(): Promise<void> {
    await expect(this.songPlayButton).toBeInViewport({ ratio: 1 })
  }

  /**
   * The bars are reachable because nothing had to be scrolled to reach them —
   * neither the page nor the grid region has anything to scroll. This is the
   * assertion the old layout fails: there, the region scrolls and the button
   * the region carries is off the bottom of it.
   */
  async verifyNothingIsScrolled(): Promise<void> {
    const region = await this.stageScroller.evaluate((element) => ({
      overflowY: element.scrollHeight - element.clientHeight,
      overflowX: element.scrollWidth - element.clientWidth,
    }))
    expect(region.overflowY).toBeLessThanOrEqual(0)
    expect(region.overflowX).toBeLessThanOrEqual(0)

    const document_ = await this.page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }))
    expect(document_.scrollHeight).toBeLessThanOrEqual(document_.clientHeight + 1)
  }

  /**
   * The grid's own scroll box inside the well is what takes up the slack on a
   * short window — the nested scroller ADR 0030 was amended for. The rows
   * scroll there; the well's footer, the frame and the page do not move.
   */
  async verifyGridWellIsTheScroller(): Promise<void> {
    const overflow = await this.gridWellScroll.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    )
    expect(overflow).toBeGreaterThan(0)
    await this.verifyNothingIsScrolled()
  }

  async scrollGridWellToBottom(): Promise<void> {
    await this.gridWellScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect
      .poll(async () => this.gridWellScroll.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0)
  }

  /** 6 rows × 16 steps, at every breakpoint — no ticket may drop one (ADR 0027). */
  async verifyGridIsSixBySixteen(): Promise<void> {
    await expect(this.page.getByTestId(/^cell-[a-z]+-\d+$/)).toHaveCount(96)
    for (const instrumentId of ['kick', 'snare', 'hat', 'tom', 'marimba', 'boop']) {
      await expect(this.cell(instrumentId, 0)).toHaveCount(1)
      await expect(this.cell(instrumentId, 15)).toHaveCount(1)
    }
  }

  /** The handoff's cell size for this breakpoint — a layout ticket may not nudge it. */
  async verifyCellGeometry(width: number, height: number): Promise<void> {
    const box = await this.cell('kick', 0).boundingBox()
    if (!box) throw new Error('the cell is not visible')
    expect(Math.round(box.width)).toBe(width)
    expect(Math.round(box.height)).toBe(height)
  }

  /**
   * The playhead column is `position: absolute` with hand-computed pixel
   * offsets, so putting `.body` in a scroll box is exactly the kind of change
   * that silently moves it: it must still be centred on its step's cell,
   * cover that cell top to bottom, and be on screen rather than clipped by the
   * scroll box it now lives in.
   */
  async verifyPlayheadCoversCell(instrumentId: string, step: number): Promise<void> {
    const column = await this.playhead().boundingBox()
    const cell = await this.cell(instrumentId, step).boundingBox()
    if (!column || !cell) throw new Error('the playhead or the cell is not visible')
    const centre = column.x + column.width / 2
    expect(Math.abs(centre - (cell.x + cell.width / 2))).toBeLessThanOrEqual(1)
    expect(column.width).toBeGreaterThan(cell.width)
    expect(column.y).toBeLessThanOrEqual(cell.y)
    expect(column.y + column.height).toBeGreaterThanOrEqual(cell.y + cell.height)
    // 0.99, not 1: a sub-pixel cell height rounds the ratio just under it.
    await expect(this.cell(instrumentId, step)).toBeInViewport({ ratio: 0.99 })
    await expect(this.playhead()).toBeInViewport()
  }

  /**
   * The phone song bar's header carries song play, so the lane strip is what
   * scrolls when the bar runs out of room — the header is never inside that
   * scroll box.
   */
  async verifySongPlayOutsideTheLaneScroller(): Promise<void> {
    const lanes = this.page.getByTestId('phone-song-lanes')
    const scrolls = await lanes.evaluate((element) => getComputedStyle(element).overflowY)
    expect(scrolls).toBe('auto')
    const inside = await this.songPlayButton.evaluate(
      (element, id) => element.closest(`[data-testid="${id}"]`) !== null,
      'phone-song-lanes',
    )
    expect(inside).toBe(false)
  }

  // --- The clip-lanes laptop layout (ticket 15) ---

  /** The old transport bar must be gone at ≥1024 — its pieces moved (handoff §6, ticket 20). */
  async verifyNoTransportBar(): Promise<void> {
    await expect(this.page.getByTestId('transport-bar')).toHaveCount(0)
  }

  /** The plain, no-dialog New boop reset in the top bar. */
  async pressNewBoop(): Promise<void> {
    await this.newBoopButton.click()
  }

  clipChip(index: number) {
    return this.page.getByTestId(`clip-chip-${index}`)
  }

  async selectClip(index: number): Promise<void> {
    await this.clipChip(index).click()
  }

  async verifyClipChipActive(index: number): Promise<void> {
    await expect(this.clipChip(index)).toHaveAttribute('data-active', 'true')
  }

  async verifyClipCount(count: number): Promise<void> {
    await expect(this.page.getByTestId(/^clip-chip-\d+$/)).toHaveCount(count)
  }

  async verifyClipChipName(index: number, name: string): Promise<void> {
    await expect(this.clipChip(index)).toContainText(name)
  }

  /** The chip's tint index — tints travel with their clips (spec §2, ticket 18). */
  async verifyChipTint(index: number, tint: number): Promise<void> {
    await expect(this.clipChip(index)).toHaveAttribute('data-tint', String(tint))
  }

  async verifyChipFocused(index: number): Promise<void> {
    await expect(this.clipChip(index)).toBeFocused()
  }

  /** Drag a chip vertically onto another chip's lane (ticket 18). */
  async dragChip(from: number, to: number): Promise<void> {
    await this.beginChipDrag(from, to)
    await this.releaseChip()
  }

  /** The drag's first half — pointer down and over the target, held for mid-drag asserts. */
  async beginChipDrag(from: number, to: number): Promise<void> {
    const source = await this.clipChip(from).boundingBox()
    const target = await this.clipChip(to).boundingBox()
    if (!source || !target) throw new Error('a clip chip is not visible')
    await this.page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
    await this.page.mouse.down()
    await this.page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, {
      steps: 6,
    })
  }

  async releaseChip(): Promise<void> {
    await this.page.mouse.up()
  }

  /** Mid-drag: the dragged chip's lane is flagged — the lift's scale + shadow ride on it. */
  async verifyChipLifted(index: number): Promise<void> {
    await expect(this.clipChip(index).locator('..')).toHaveAttribute('data-dragging', 'true')
  }

  /** Mid-drag: this chip's lane has stepped aside — the live make-way. */
  async verifyLaneMakingWay(index: number, direction: 'up' | 'down'): Promise<void> {
    const shift = direction === 'up' ? /translateY\(-/ : /translateY\(\d/
    await expect(this.clipChip(index).locator('..')).toHaveAttribute('style', shift)
  }

  /** A press that wanders under the ~8px drag threshold — still a tap-to-select. */
  async pressChipBelowThreshold(index: number): Promise<void> {
    const box = await this.clipChip(index).boundingBox()
    if (!box) throw new Error('the clip chip is not visible')
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await this.page.mouse.move(x, y)
    await this.page.mouse.down()
    await this.page.mouse.move(x, y + 3)
    await this.page.mouse.up()
  }

  /** Ctrl/Cmd+ArrowUp/Down on a focused chip moves its lane (spec §8/§14). */
  async reorderChipByKeyboard(index: number, direction: 'up' | 'down'): Promise<void> {
    await this.clipChip(index).press(direction === 'up' ? 'Control+ArrowUp' : 'Control+ArrowDown')
  }

  /** The clip header's name — also the chip's, but the header is the editable one. */
  async verifyActiveClipName(name: string): Promise<void> {
    await expect(this.page.getByTestId('clip-name')).toHaveText(name)
  }

  /** Rename via the pencil: type, Enter commits. */
  async renameActiveClip(name: string): Promise<void> {
    await this.page.getByTestId('clip-rename-button').click()
    const input = this.page.getByTestId('clip-rename-input')
    await input.fill(name)
    await input.press('Enter')
  }

  async copyClip(): Promise<void> {
    await this.page.getByTestId('clip-copy-button').click()
  }

  async deleteClip(): Promise<void> {
    await this.page.getByTestId('clip-delete-button').click()
  }

  async verifyDeleteClipDisabled(): Promise<void> {
    await expect(this.page.getByTestId('clip-delete-button')).toBeDisabled()
  }

  /** A copy is a new clip, so the 5-clip cap greys it like "+ New clip". */
  async verifyCopyClipDisabled(): Promise<void> {
    await expect(this.page.getByTestId('clip-copy-button')).toBeDisabled()
  }

  /** Add a blank clip the whole way: "+ New clip" opens the picker, Blank lands it (ticket 17). */
  async addClip(): Promise<void> {
    await this.openNewClipPicker()
    await this.pickClip('blank')
  }

  async verifyAddClipDisabled(): Promise<void> {
    await expect(this.page.getByTestId('new-clip-button')).toBeDisabled()
  }

  laneSquare(clipIndex: number, position: number) {
    return this.page.getByTestId(`lane-${clipIndex}-${position}`)
  }

  async toggleLaneSquare(clipIndex: number, position: number): Promise<void> {
    await this.laneSquare(clipIndex, position).click()
  }

  async verifyPlacementOn(clipIndex: number, position: number): Promise<void> {
    await expect(this.laneSquare(clipIndex, position)).toHaveAttribute('data-on', 'true')
  }

  async verifyPlacementOff(clipIndex: number, position: number): Promise<void> {
    await expect(this.laneSquare(clipIndex, position)).toHaveAttribute('data-on', 'false')
  }

  /** No lane square marks a "next free" position — the dashed hint is gone (ticket 24). */
  async verifyNoPlacementHint(): Promise<void> {
    await expect(this.page.locator('[data-testid^="lane-"][data-hint]')).toHaveCount(0)
  }

  /**
   * A focus ring is drawn 4px outside its button (a 2px outline at a 2px
   * offset), and a scroll box clips on every side, not just the scrolling one
   * — so every button inside one needs 4px of room within its scrollable
   * area, or the ring is sliced off (ticket 25).
   */
  async verifyFocusRingsFitTheScrollBox(testId: string): Promise<void> {
    const room = await this.page.getByTestId(testId).evaluate((box: HTMLElement) => {
      const outer = box.getBoundingClientRect()
      // The scrollable area's edges, in viewport coordinates.
      const left = outer.left + box.clientLeft - box.scrollLeft
      const top = outer.top + box.clientTop - box.scrollTop
      const right = left + box.scrollWidth
      const bottom = top + box.scrollHeight
      return [...box.querySelectorAll<HTMLElement>('button')].map((button) => {
        const rect = button.getBoundingClientRect()
        return Math.min(rect.left - left, rect.top - top, right - rect.right, bottom - rect.bottom)
      })
    })
    expect(room.length).toBeGreaterThan(0)
    expect(Math.min(...room)).toBeGreaterThanOrEqual(4)
  }

  /** The ruler numeral sits over its own square — the lane grid lines up column-for-column. */
  async verifyRulerAlignedOverSquare(position: number): Promise<void> {
    const numeral = await this.page.getByTestId(`song-position-numeral-${position}`).boundingBox()
    const square = await this.laneSquare(0, position).boundingBox()
    if (!numeral || !square) throw new Error('the ruler numeral or the lane square is not visible')
    const centre = numeral.x + numeral.width / 2
    expect(centre).toBeGreaterThanOrEqual(square.x)
    expect(centre).toBeLessThanOrEqual(square.x + square.width)
  }

  /** The song bar's `<n> bars` readout — placed squares × 4. */
  async verifySongLength(text: string): Promise<void> {
    await expect(this.page.getByTestId('song-length')).toHaveText(text)
  }

  // --- The tablet band (boop-loops ticket 20, spec §4 — variant E) ---

  /**
   * Variant E's fit: chips and "+ New clip" narrow to 128px, the squares turn
   * flexible — compressed below the laptop's fixed 56px, all equal — and the
   * ruler numerals track the squares column-for-column.
   */
  async verifyLaneGridFitsColumn(): Promise<void> {
    const chip = await this.clipChip(0).boundingBox()
    const newClip = await this.page.getByTestId('new-clip-button').boundingBox()
    if (!chip || !newClip) throw new Error('the chip or the New clip button is not visible')
    expect(Math.round(chip.width)).toBe(128)
    expect(Math.round(newClip.width)).toBe(128)

    const squares = []
    for (let position = 0; position < 16; position += 1) {
      const box = await this.laneSquare(0, position).boundingBox()
      if (!box) throw new Error(`lane square ${position} is not visible`)
      squares.push(box)
    }
    const first = squares[0]!
    const last = squares[15]!
    expect(first.width).toBeLessThan(56)
    expect(first.width).toBeGreaterThanOrEqual(20)

    // The fit itself: all 16 squares the same width as each other, and the row
    // ending flush with the lane grid's content edge — so they and their gaps
    // add up to the column exactly. Anything that changes one square's
    // geometry, or the width they share out, breaks one half or the other.
    const widths = squares.map((box) => box.width)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(0.5)
    const contentRight = await this.page.getByTestId('song-lanes').evaluate((box: HTMLElement) => {
      const rect = box.getBoundingClientRect()
      return rect.right - parseFloat(getComputedStyle(box).paddingRight)
    })
    expect(Math.abs(last.x + last.width - contentRight)).toBeLessThanOrEqual(1)

    const numeral = await this.page.getByTestId('song-position-numeral-15').boundingBox()
    if (!numeral) throw new Error('the ruler numeral is not visible')
    const centre = numeral.x + numeral.width / 2
    expect(centre).toBeGreaterThanOrEqual(last.x)
    expect(centre).toBeLessThanOrEqual(last.x + last.width)
  }

  /**
   * "No sideways scroll anywhere at this width" (spec §4): nothing on the
   * page — the lane grid included — scrolls horizontally.
   */
  async verifyNoSidewaysScroller(): Promise<void> {
    await this.verifyNoHorizontalOverflow()
    const scrollers = await this.page.evaluate(() =>
      [...document.querySelectorAll('*')].filter((element) => {
        const { overflowX } = getComputedStyle(element)
        return (
          (overflowX === 'auto' || overflowX === 'scroll') &&
          element.scrollWidth > element.clientWidth
        )
      }).length,
    )
    expect(scrollers).toBe(0)
  }

  // --- The phone clip lanes (boop-loops ticket 21, spec §5 — variant B) ---

  private readonly phoneSongBar = this.page.getByTestId('phone-song-bar')

  laneWindow() {
    return this.page.getByTestId('phone-lane-window')
  }

  /** The song bar lives inside the scrolling region — nothing new is pinned (ADR 0030). */
  async verifySongBarInsideGridRegion(): Promise<void> {
    const inside = await this.phoneSongBar.evaluate(
      (element, id) => element.closest(`[data-testid="${id}"]`) !== null,
      'stage-scroller',
    )
    expect(inside).toBe(true)
  }

  /**
   * The lanes reuse the step window's exact geometry (ticket 21): with both
   * windows at rest, a lane square sits exactly under its grid column — same
   * left edge, same 32px width.
   */
  async verifyLaneSquareAlignedUnderCell(position: number): Promise<void> {
    const cell = await this.cell('kick', position).boundingBox()
    const square = await this.laneSquare(0, position).boundingBox()
    if (!cell || !square) throw new Error('the grid cell or the lane square is not visible')
    expect(Math.round(square.x)).toBe(Math.round(cell.x))
    expect(Math.round(square.width)).toBe(Math.round(cell.width))
  }

  /** A real sideways swipe over the lane window — the browser owns the pan. */
  async swipeLanes(deltaX: number): Promise<void> {
    const box = await this.laneWindow().boundingBox()
    if (!box) throw new Error('the phone lane window is not visible')
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await this.page.mouse.wheel(deltaX, 0)
  }

  /** Wait for the snap to settle on a bar line at the given strip offset. */
  async verifyLaneWindowAt(offset: number): Promise<void> {
    await expect
      .poll(async () => this.laneWindow().evaluate((element) => element.scrollLeft))
      .toBe(offset)
  }

  /** Drag-paint across a run of lane squares on one lane — `dragPaint`'s twin. */
  async dragPaintLanes(clipIndex: number, positions: number[]): Promise<void> {
    const [first, ...rest] = positions
    if (first === undefined) return
    const startBox = await this.laneSquare(clipIndex, first).boundingBox()
    if (!startBox) throw new Error(`lane square ${clipIndex}-${first} is not visible`)
    await this.page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2)
    await this.page.mouse.down()
    for (const position of rest) {
      const box = await this.laneSquare(clipIndex, position).boundingBox()
      if (!box) throw new Error(`lane square ${clipIndex}-${position} is not visible`)
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    }
    await this.page.mouse.up()
  }

  /** The ×n placement count on a chip. */
  async verifyChipPlacementCount(index: number, text: string): Promise<void> {
    await expect(this.page.getByTestId(`clip-count-${index}`)).toHaveText(text)
  }

  // --- Song playback (ticket 16) ---

  private readonly songPlayButton = this.page.getByTestId('song-play-button')

  async pressSongPlay(): Promise<void> {
    await this.songPlayButton.click()
  }

  async verifySongPlaying(): Promise<void> {
    await expect(this.songPlayButton).toHaveAttribute('aria-pressed', 'true')
  }

  async verifySongStopped(): Promise<void> {
    await expect(this.songPlayButton).toHaveAttribute('aria-pressed', 'false')
  }

  /** The playing ring on the lane square whose position is sounding. */
  async verifyPositionPlaying(clipIndex: number, position: number): Promise<void> {
    await expect(this.laneSquare(clipIndex, position)).toHaveAttribute('data-playing', 'true')
  }

  async verifyNoPositionPlaying(): Promise<void> {
    await expect(this.page.locator('[data-testid^="lane-"][data-playing="true"]')).toHaveCount(0)
  }

  async verifyPositionNumeralPlaying(position: number): Promise<void> {
    await expect(this.page.getByTestId(`song-position-numeral-${position}`)).toHaveAttribute(
      'data-playing',
      'true',
    )
  }

  /**
   * Fire `count` scheduled steps, advancing the draw clock past each one —
   * one audible step per iteration, schedule and draw together. Use the
   * separate `fireStep`/`advanceDrawClock` pair to hold the draw clock back
   * and observe the schedule-time lookahead instead.
   */
  async crankSteps(count: number): Promise<void> {
    await this.page.evaluate(
      ({ key, count: steps, stepSeconds }) => {
        const driver = (
          globalThis as unknown as Record<
            string,
            { fireStep: () => void; now: () => number; advanceTo: (time: number) => void }
          >
        )[key]!
        for (let i = 0; i < steps; i += 1) {
          driver.fireStep()
          driver.advanceTo(driver.now() + stepSeconds)
        }
      },
      { key: BOOP_AUDIO_DRIVER_KEY, count, stepSeconds: CRANK_STEP_SECONDS },
    )
  }

  /** Assert the samples the fake driver has been told to play, in call order. */
  async verifyPlayed(expected: PlayedSample[]): Promise<void> {
    const played = await this.page.evaluate((key) => {
      const driver = (globalThis as unknown as Record<string, { played: PlayedSample[] }>)[key]!
      return driver.played
    }, BOOP_AUDIO_DRIVER_KEY)
    expect(played).toEqual(expected)
  }
}

/**
 * Both clicks land in a single task, so React has not re-rendered between
 * them — the impatient double-tap that only a ref guard can stop, as opposed
 * to two `click()` actions with a round-trip in between.
 */
async function doubleClickInOneTask(locator: Locator): Promise<void> {
  await locator.evaluate((element: HTMLButtonElement) => {
    element.click()
    element.click()
  })
}
