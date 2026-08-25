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

  /**
   * The app has landed on its home surface. That is the *song bar* since
   * screenspace ticket 03, at every width: the grid is behind a tap now, so
   * asserting the step grid here would only ever assert that the card was
   * open.
   */
  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByText('boop', { exact: true })).toBeVisible()
    await expect(this.songBar).toBeVisible()
  }

  cell(instrumentId: string, step: number) {
    return this.page.getByTestId(`cell-${instrumentId}-${step}`)
  }

  async toggleCell(instrumentId: string, step: number): Promise<void> {
    await this.ensureClipEditorOpen()
    await this.cell(instrumentId, step).click()
  }

  /**
   * Drag-paint across a run of steps on one row, real mouse-down/move/up so
   * the browser generates the pointerdown/pointerenter sequence the grid's
   * latched drag-paint listens for — pointer-down on `steps[0]` decides
   * add-or-remove, then every later step in `steps` gets that same decision.
   */
  async dragPaint(instrumentId: string, steps: number[]): Promise<void> {
    await this.ensureClipEditorOpen()
    const [first, ...rest] = steps
    if (first === undefined) return
    // The rows scroll inside the well (ticket 23), so the row being painted may
    // be below its visible band — and raw mouse moves do not scroll the way a
    // locator click does. A real finger scrolls to it first.
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
    await this.ensureClipEditorOpen()
    await this.cell(instrumentId, step).focus()
    await this.page.keyboard.press('Enter')
  }

  async focusCell(instrumentId: string, step: number): Promise<void> {
    await this.ensureClipEditorOpen()
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
    await this.reachClearGrid()
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
    await this.reachClearGrid()
    await this.clearGridButton.click()
  }

  /**
   * Clear grid has two homes, and screenspace ticket 03 moved neither: the
   * clip control inside the well at ≥1024, the phone's "⋯" menu below it. The
   * well is inside the editor card now and the menu is behind it, so the two
   * routes go opposite ways.
   */
  private async reachClearGrid(): Promise<void> {
    if (await this.isPhoneLayout()) await this.openPhoneMenu()
    else await this.ensureClipEditorOpen()
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
    await this.ensureClipEditorClosed()
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
    await expect(this.page.getByTestId('picker-cards').getByRole('button')).toHaveText(expected)
  }

  /**
   * New boop is a plain reset: it puts no picker and no panel on screen. The
   * clip editor card is a dialog too since screenspace ticket 03, so this asks
   * about the two dialogs New boop could plausibly have opened rather than
   * about `role=dialog` in general.
   */
  async verifyNoDialogOpen(): Promise<void> {
    await expect(this.pickerDialog).toHaveCount(0)
    await expect(this.boopsCard).toHaveCount(0)
  }

  // --- The song bar as the home surface, and the clip editor card
  // (screenspace ticket 03) ---

  /** The home surface: `SongBar` at ≥1024, `PhoneSongBar` below it. */
  private readonly songBar = this.page
    .getByTestId('song-bar')
    .or(this.page.getByTestId('phone-song-bar'))
  private readonly clipLauncher = this.page.getByTestId('clip-launcher')
  private readonly clipLauncherPlay = this.page.getByTestId('clip-launcher-play')
  private readonly clipLauncherOpen = this.page.getByTestId('clip-launcher-open')
  private readonly clipEditorCard = this.page.getByTestId('clip-editor-card')
  private readonly clipEditorOverlay = this.page.getByTestId('clip-editor-overlay')
  private readonly clipEditorClose = this.page.getByTestId('clip-editor-close-button')

  /**
   * The grid is behind a tap since screenspace ticket 03, so a helper that
   * acts *on the grid* opens the card first — the tap a child makes on the way
   * in. Assertions never route: they read whatever is on screen, so a test that
   * asserts about the grid has to have acted on it (or opened the card itself)
   * first, and a test about the arrangement cannot be quietly given a card it
   * did not open.
   */
  private async ensureClipEditorOpen(): Promise<void> {
    if ((await this.clipEditorCard.count()) === 0) await this.openClipEditor()
  }

  /**
   * The mirror image: the song bar and the chrome are *behind* the card, so a
   * helper that acts on either closes it first. Same reasoning — the route is
   * the page object's business, the behaviour is the test's.
   *
   * `verifyBandDoesNotScroll` is the one assertion that routes, and only
   * because it swipes the surface under the band before it measures — it is an
   * action wearing an assertion's name. Nothing else that only reads the DOM
   * may call either of these.
   */
  private async ensureClipEditorClosed(): Promise<void> {
    if ((await this.clipEditorCard.count()) > 0) await this.closeClipEditor()
  }

  /** Route one into the editor: the dock's labelled launcher. */
  async openClipEditor(): Promise<void> {
    await this.clipLauncherOpen.click()
    await expect(this.clipEditorCard).toBeVisible()
  }

  /**
   * Route two: a tap on a clip chip in the song bar. It selects that clip and
   * opens the editor on it — a child who taps the thing they want to change
   * expects to be changing it.
   */
  async openClipEditorFromChip(index: number): Promise<void> {
    await this.clipChip(index).click()
    await expect(this.clipEditorCard).toBeVisible()
  }

  async closeClipEditor(): Promise<void> {
    await this.clipEditorClose.click()
    await expect(this.clipEditorCard).toHaveCount(0)
  }

  /** A tap on the dimmed backdrop, the way "My boops" and the picker dismiss. */
  async dismissClipEditorByOutsideTap(): Promise<void> {
    await this.clipEditorOverlay.click({ position: { x: 5, y: 5 } })
    await expect(this.clipEditorCard).toHaveCount(0)
  }

  async verifyClipEditorOpen(): Promise<void> {
    await expect(this.clipEditorCard).toBeVisible()
    await expect(this.page.getByRole('application', { name: /step grid/ })).toBeVisible()
  }

  async verifyClipEditorClosed(): Promise<void> {
    await expect(this.clipEditorCard).toHaveCount(0)
    await expect(this.page.getByRole('application', { name: /step grid/ })).toHaveCount(0)
  }

  /** The card names the clip it opened on — it has no title of its own. */
  async verifyClipEditorLabelled(clipName: string): Promise<void> {
    await expect(this.page.getByRole('dialog', { name: `Editing ${clipName}` })).toBeVisible()
  }

  /** The song bar is on the frame and the grid is not — the resting arrangement. */
  async verifySongBarIsTheHomeSurface(): Promise<void> {
    await expect(this.songBar).toBeVisible()
    await expect(this.songBar).toBeInViewport()
    await this.verifyClipEditorClosed()
    const inside = await this.songBar.evaluate(
      (element, id) => element.closest(`[data-testid="${id}"]`) !== null,
      'stage-scroller',
    )
    expect(inside).toBe(true)
  }

  /** The launcher is in the dock, and the dock holds nothing else. */
  async verifyLauncherIsTheWholeDock(): Promise<void> {
    await expect(this.clipLauncher).toBeInViewport({ ratio: 1 })
    const siblings = await this.clipLauncher.evaluate(
      (element) => element.parentElement?.childElementCount ?? -1,
    )
    expect(siblings).toBe(1)
  }

  /**
   * Clear grid is the "⋯" menu's on the phone (design handoff), so the well
   * footer carries play alone there — two Clear buttons would be one too many.
   */
  async verifyNoClearGridInTheWell(): Promise<void> {
    await expect(this.page.getByTestId('clip-control').getByTestId('clear-grid-button')).toHaveCount(
      0,
    )
  }

  /** The launcher names the clip the card would open on. */
  async verifyLauncherClip(name: string): Promise<void> {
    await expect(this.page.getByTestId('clip-launcher-name')).toHaveText(name)
  }

  /**
   * The card must not clip the fixed-geometry column it contains (ticket 29) —
   * measured against the frame it replaced, not against its own stylesheet.
   *
   * The frame gave the grid `stage-column`'s width. The card has to give it at
   * least as much, and it is *not* free to: the overlay's gutter and the
   * card's own padding both come out of the same budget, so a dialog-sized
   * 32px gutter left the well 25px short at 1024 and 8px short at 1280 — the
   * width ADR 0033 exists to make fit. Comparing the card with `--column-width`
   * cannot catch that, because both numbers come from the same stylesheet
   * rule; comparing it with the frame's live column can.
   */
  async verifyCardHoldsTheColumn(): Promise<void> {
    const frame = await this.page.getByTestId('stage-column').boundingBox()
    if (!frame) throw new Error('the stage column is not visible')
    const measured = await this.clipEditorCard.evaluate((element) => {
      const style = getComputedStyle(element)
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      return {
        inner: element.getBoundingClientRect().width - padding,
        overflow: element.scrollWidth - element.clientWidth,
      }
    })
    expect(Math.round(measured.inner)).toBeGreaterThanOrEqual(Math.round(frame.width))
    expect(measured.overflow).toBeLessThanOrEqual(0)
  }

  /**
   * Start from an empty grid, the way a child would: the New boop reset, then
   * open the clip editor on the blank clip it leaves. A fresh browser is
   * seeded with a sample clip (tickets 36/17), so a suite that is about grid
   * behaviour rather than onboarding has to say where it starts.
   *
   * It opens the card because the grid is behind a tap since screenspace
   * ticket 03 and nearly every caller here is about the grid. A suite that
   * wants the reset *without* the editor calls `pressNewBoop` instead.
   */
  async startBlank(): Promise<void> {
    await this.pressNewBoop()
    await this.openClipEditor()
  }

  async verifyCellOn(instrumentId: string, step: number): Promise<void> {
    await expect(this.cell(instrumentId, step)).toHaveAttribute('data-active', 'true')
  }

  async verifyCellOff(instrumentId: string, step: number): Promise<void> {
    await expect(this.cell(instrumentId, step)).toHaveAttribute('data-active', 'false')
  }

  /**
   * Clip play by whichever of its two routes is on screen (screenspace ticket
   * 03): the well's footer when the editor card is open, the dock's launcher
   * when it is not. The card's backdrop covers the dock, so a test that opened
   * the editor genuinely cannot reach the launcher — pressing the one that is
   * there is what a child does. `pressWellClipPlay` names the in-card button
   * when the distinction is the point.
   */
  async pressPlay(): Promise<void> {
    if ((await this.clipEditorCard.count()) > 0) await this.playButton.click()
    else await this.clipLauncherPlay.click()
  }

  async pressWellClipPlay(): Promise<void> {
    await this.ensureClipEditorOpen()
    await this.playButton.click()
  }

  async verifyPlaying(): Promise<void> {
    await expect(this.clipLauncherPlay).toHaveAttribute('aria-pressed', 'true')
  }

  async verifyPaused(): Promise<void> {
    await expect(this.clipLauncherPlay).toHaveAttribute('aria-pressed', 'false')
  }

  /**
   * Drag the tempo slider to a given position on its 0–100 percent track.
   * Deliberately not routed past the clip editor card: this sets the input's
   * value rather than aiming a finger at it, and suites whose subject is the
   * grid change the tempo mid-test without meaning to leave the editor.
   */
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
        const driver = (
          globalThis as unknown as Record<string, { advanceTo: (time: number) => void }>
        )[key]!
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
    await expect(this.playhead()).toHaveAttribute('data-playing', 'true')
  }

  /**
   * Stopped, the playhead stays on the step it stopped on rather than
   * unmounting (boop-playhead ticket 04): where we are is a fact about the
   * boop, drawn at 45%.
   */
  async verifyPlayheadStoppedAtStep(step: number): Promise<void> {
    await expect(this.playhead()).toHaveAttribute('data-step', String(step))
    await expect(this.playhead()).toHaveAttribute('data-playing', 'false')
  }

  /**
   * No playhead at all — since ticket 04 that means only "nothing has sounded
   * yet", never "we are stopped": a stop leaves the playhead where it was.
   */
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
    await expect(this.page.getByTestId(`row-label-${instrumentId}`)).toHaveAttribute(
      'data-struck',
      'true',
    )
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
    await this.ensureClipEditorClosed()
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
    await this.ensureClipEditorClosed()
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
    await this.ensureClipEditorClosed()
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

  /**
   * Open the "⋯" menu, or leave it open — the button is a toggle, and helpers
   * that route through here (New boop, Clear grid) must not shut a menu the
   * test opened deliberately.
   */
  async openPhoneMenu(): Promise<void> {
    await this.ensureClipEditorClosed()
    const menu = this.page.getByTestId('phone-menu')
    if ((await menu.count()) === 0) await this.phoneMenuButton.click()
    await expect(menu).toBeVisible()
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
    await this.ensureClipEditorOpen()
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
    await this.ensureClipEditorClosed()
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

  /**
   * Whole dock on screen, not merely intersecting it. The dock is the clip
   * launcher at every width since screenspace ticket 03 — the transport is
   * gone and the song bar moved into the scrolling region.
   */
  async verifyLauncherFullyInViewport(): Promise<void> {
    await expect(this.clipLauncher).toBeInViewport({ ratio: 1 })
  }

  async verifyTopBarFullyInViewport(): Promise<void> {
    await expect(this.page.getByText('boop', { exact: true })).toBeInViewport({ ratio: 1 })
  }

  /**
   * The bar is inset to the centred column, not full-bleed — ticket 33's
   * decision 1, reversed by the layout prototype (ticket 37).
   */
  async verifyLauncherInsetToColumn(): Promise<void> {
    const bar = await this.clipLauncher.boundingBox()
    const column = await this.page.getByTestId('stage-column').boundingBox()
    if (!bar || !column) throw new Error('the clip launcher or the stage column is not visible')
    expect(Math.round(bar.x)).toBe(Math.round(column.x))
    expect(Math.round(bar.width)).toBe(Math.round(column.width))
  }

  /** Nothing inside the launcher spills sideways — a long clip name ellipsises. */
  async verifyLauncherHasNoOverflow(): Promise<void> {
    const overflow = await this.clipLauncher.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  }

  /**
   * The launcher carries *clip* play and nothing else that has a home
   * elsewhere (screenspace ticket 03): Speed is the song bar header's, and so
   * is song play — repeating either here is the duplication the ticket removed.
   */
  async verifyLauncherCarriesClipPlayOnly(): Promise<void> {
    await expect(this.clipLauncher.getByTestId('tempo-slider')).toHaveCount(0)
    await expect(this.clipLauncher.getByTestId('tempo-readout')).toHaveCount(0)
    await expect(this.clipLauncher.getByTestId('song-play-button')).toHaveCount(0)
    await expect(this.clipLauncher.getByTestId('clip-launcher-play')).toHaveCount(1)
  }

  /**
   * New boop is a 44px tap target on the phone, like the rest of the chrome.
   * It is an entry in the "⋯" menu since screenspace ticket 03, so the menu is
   * where it gets measured.
   */
  async verifyNewBoopButtonTapTarget(): Promise<void> {
    if (await this.isPhoneLayout()) await this.openPhoneMenu()
    const box = await this.newBoopButton.boundingBox()
    if (!box) throw new Error('the New boop button is not visible')
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }

  /**
   * The loop map is glued under the grid, inside the grid well — it must never
   * migrate into a pinned bar and become a second transport (ADR 0027). It
   * used to be "inside the scrolling region"; the grid moved into the clip
   * editor card (screenspace ticket 03) and the map went with it, so the well
   * is what the rule is about now, and the dock is the bar it must stay out of.
   */
  async verifyLoopMapInsideGridWell(): Promise<void> {
    const loopMap = this.page.getByTestId('loop-map')
    const inWell = await loopMap.evaluate(
      (element, id) => element.closest(`[data-testid="${id}"]`) !== null,
      'clip-editor-card',
    )
    expect(inWell).toBe(true)
    const inDock = await loopMap.evaluate(
      (element, id) => element.closest(`[data-testid="${id}"]`) !== null,
      'clip-launcher',
    )
    expect(inDock).toBe(false)
  }

  // --- The pinned play bars (ticket 23) ---

  private readonly gridWellScroll = this.page.getByTestId('grid-scroll')

  /**
   * Clip play: the dock's launcher, at every width and whether or not the
   * editor card is open (screenspace ticket 03).
   */
  async verifyClipPlayFullyInViewport(): Promise<void> {
    await expect(this.clipLauncherPlay).toBeInViewport({ ratio: 1 })
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
    // The *page* never scrolls — that part of ADR 0030 is absolute. Whether
    // the grid region scrolls is not: since the grid gained a floor, a phone
    // short enough will scroll the region rather than shrink the grid away.
    // Callers that mean the stronger thing say `verifyNothingIsScrolled` too.
    const document_ = await this.page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }))
    expect(document_.scrollHeight).toBeLessThanOrEqual(document_.clientHeight + 1)
  }

  /**
   * The guard that came with the scroll box, and the only thing that can see
   * the playhead's overhang escape it. `overflow-y: auto` computes the other
   * axis to `auto` too, so anything wider than the box's padding box gives it
   * a sideways scroll — and the playhead column overhangs `.body` by 8px at
   * laptop, which is what `.wellScroll`'s padding is there to hold.
   *
   * A slice is *not* the symptom to look for: overflowing content grows
   * `scrollWidth` rather than being cut, so it stays inside the scrollable
   * area, so the playhead-against-its-cell comparison below cannot see it —
   * the column and the cell move together. The sideways scroll is the symptom.
   *
   * Only meaningful at a width where the column itself fits — at 1280 the
   * 1320px grid is legitimately wider than the column, and the box's sideways
   * scroll is what keeps all 16 steps reachable.
   */
  async verifyGridWellHasNoSidewaysScroll(): Promise<void> {
    const overflow = await this.gridWellScroll.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  }

  async scrollGridWellToBottom(): Promise<void> {
    await this.ensureClipEditorOpen()
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
   * The grid gives up its slack before the lane strip gives up anything
   * (ticket 23, as the repo owner settled it): on the default one-clip phone
   * screen the strip is whole and unscrolled, however short the window. A
   * chopped lane row under a scrollbar is not what "the grid scrolls, not the
   * bar" asked for.
   */
  async verifyLaneStripWhole(): Promise<void> {
    const strip = await this.page.getByTestId('phone-song-lanes').evaluate((element) => ({
      overflow: element.scrollHeight - element.clientHeight,
      scrollTop: element.scrollTop,
    }))
    expect(strip.overflow).toBeLessThanOrEqual(0)
    expect(strip.scrollTop).toBe(0)
  }

  /**
   * The phone grid's three-row floor is retired (screenspace ticket 04), and
   * this is what replaced it. The floor guaranteed rows by refusing to shrink,
   * and once screenspace ticket 03 put clip play *inside* the well that
   * refusal was paid for with the button: measured with the floor on, clip
   * play landed wholly below the fold at 390x380 and at 667x375, and 13px
   * below it at 390x420.
   *
   * So the promise is no longer "at least three rows, whatever it costs" but
   * "the well fits the card, and the button under the rows is reachable" —
   * which is the promise `Grid.module.scss`'s floorless well has always kept.
   * Callers still say how much grid they expect at the viewport they are
   * testing (`verifyGridShowsAtLeast`); what this adds is the cost the floor
   * used to hide.
   */
  async verifyClipPlayInWellIsReachable(): Promise<void> {
    await expect(this.page.getByTestId('play-button')).toBeInViewport({ ratio: 1 })
    await this.verifyNotOccluded('play-button')
  }

  /**
   * Screenspace ticket 04's own verify list, and the reason it is a helper
   * rather than a list in one suite: the three retired compromises all existed
   * to keep controls reachable, so "reachable" is what has to be pinned in
   * their place — every control the width offers, whole in the viewport and
   * not painted over, with the page still.
   *
   * The card is opened and closed inside it, because the two surfaces are
   * never on screen together: the launcher and the song bar are behind the
   * card's backdrop while it is up, and clip play in the well is behind
   * nothing only while it is.
   */
  async verifyEveryControlIsReachable(): Promise<void> {
    await this.ensureClipEditorClosed()
    await this.verifyStageIsAFixedFrame()

    // On the frame: song play, Speed, and the launcher's two.
    for (const id of [
      'song-play-button',
      'tempo-slider',
      'clip-launcher-play',
      'clip-launcher-open',
    ])
      await this.verifyControlIsReachable(id)
    // The phone's actions are all in the "⋯" menu, so the button is the one
    // that has to be on the frame. "+ New clip" is deliberately *not* here:
    // it is the last cell of the lane grid, inside that grid's own scroll box
    // (ADR 0030's nested-scroller exception), so at five clips it is below the
    // fold of a box the child scrolls — and disabled there anyway.
    if (await this.isPhoneLayout()) await this.verifyControlIsReachable('phone-menu-button')
    else await this.verifyControlIsReachable('new-boop-button')

    // In the card: the clip header's actions and clip play under the rows.
    await this.openClipEditor()
    await this.verifyStageIsAFixedFrame()
    for (const id of ['clip-editor-close-button', 'clip-rename-button', 'play-button'])
      await this.verifyControlIsReachable(id)
    await this.ensureClipEditorClosed()
  }

  private async verifyControlIsReachable(testId: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).toBeInViewport({ ratio: 1 })
    await this.verifyNotOccluded(testId)
  }

  /**
   * The frame is fixed at *every* height (screenspace ticket 04). Below 505px
   * `.stage` used to become `height: auto; min-height: 100dvh` and the
   * document scrolled, because no arrangement kept both play buttons clear
   * while the grid and the song bar shared the screen. Only the song bar is on
   * the frame now, so the exception has nothing left to buy and the stage is
   * the viewport again at 460 exactly as it is at 900.
   *
   * `verifyPageDoesNotScroll` alone cannot see this: the exception's own
   * max-heights kept the document short enough not to scroll, so the page sat
   * still on both sides of the threshold. What tells them apart is whether the
   * stage is *bounded* by the window or merely at least as tall as it.
   */
  async verifyStageIsAFixedFrame(): Promise<void> {
    const stage = await this.page.getByTestId('stage').evaluate((element) => ({
      height: Math.round(element.getBoundingClientRect().height),
      viewport: window.innerHeight,
      overflow: element.scrollHeight - element.clientHeight,
    }))
    expect(stage.height).toBe(stage.viewport)
    expect(stage.overflow).toBeLessThanOrEqual(0)
    await this.verifyPageDoesNotMove()
  }

  /**
   * The retired 505px threshold, asserted as absent (screenspace ticket 04).
   * 504 and 505 were the deciding pair: 126px of page overflow on one side of
   * it and zero on the other, because `.stage` stopped being a fixed frame.
   * Nothing keys off that height any more, so resizing across it must move the
   * grid by the pixel of window it lost and no more.
   *
   * A boundary that has gone cannot be pinned by testing either side of it in
   * isolation — both sides pass whatever the layout does. Crossing it in one
   * page is what makes a step visible.
   */
  async verifyResizingDoesNotStepTheGrid(width: number, height: number): Promise<void> {
    const before = await this.gridWellScroll.evaluate((element) => element.clientHeight)
    const lost = (this.page.viewportSize()?.height ?? 0) - height
    await this.page.setViewportSize({ width, height })
    const after = await this.gridWellScroll.evaluate((element) => element.clientHeight)
    // No more than the window gave up, and never in the other direction. The
    // exception's step was 31px of grid across that one pixel, in the wrong
    // direction: the page-scrolling side capped the well and showed *less*.
    expect(before - after).toBeGreaterThanOrEqual(0)
    expect(before - after).toBeLessThanOrEqual(lost)
  }

  /**
   * How much grid is on screen and uncovered, in pixels. Neither renderer has
   * a floor since screenspace ticket 04, so callers state the height they
   * expect at the viewport they are testing rather than reading a constant —
   * the well degrades with the window instead of stepping at a threshold.
   *
   * Height alone is not enough. A well of exactly the right height can still
   * sit entirely above the viewport once the region scrolls, so the rows have
   * to be on screen and uncovered, which is what a child actually needs.
   */
  async verifyGridShowsAtLeast(px: number): Promise<void> {
    const visible = await this.gridWellScroll.evaluate((element) => element.clientHeight)
    expect(visible).toBeGreaterThanOrEqual(px)
    await expect(this.cell('kick', 0)).toBeInViewport({ ratio: 0.99 })
    await this.verifyNotOccluded('cell-kick-0')
  }

  /**
   * Really on screen, not merely inside the viewport rectangle.
   * `toBeInViewport` measures intersection with the viewport, so it calls an
   * element visible while pinned chrome sits on top of it — which is exactly
   * what happens to the song bar's header when the region scrolls. This asks
   * the browser what is painted at the button's centre and around it.
   *
   * The sample points stay a quarter of the way in from each edge rather than
   * on the corners: these buttons are circles, and a bounding box's corners
   * are outside the circle, where the browser correctly reports whatever is
   * painted behind it.
   */
  async verifyNotOccluded(testId: string): Promise<void> {
    const covered = await this.page.getByTestId(testId).evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      const midX = x + width / 2
      const midY = y + height / 2
      const points: Array<[number, number]> = [
        [midX, midY],
        [midX, y + height / 4],
        [midX, y + (height * 3) / 4],
        [x + width / 4, midY],
        [x + (width * 3) / 4, midY],
      ]
      return points
        .map(([px, py]) => document.elementFromPoint(px, py))
        .filter((top) => top === null || !element.contains(top))
        .map((top) => (top === null ? 'nothing (off screen)' : (top as HTMLElement).tagName))
    })
    expect(covered).toEqual([])
  }




  /**
   * Stronger than reading `scrollHeight`, and the assertion that would have
   * caught the sub-610px laptop band: it asks the browser to scroll and checks
   * that nothing moved. A 1px overflow is exactly what 1280x600 had, and a
   * `+1` tolerance cannot see it — but the page really did move.
   */
  async verifyPageDoesNotMove(): Promise<void> {
    const moved = await this.page.evaluate(() => {
      window.scrollTo(0, 200)
      const y = Math.round(window.scrollY)
      window.scrollTo(0, 0)
      return y
    })
    expect(moved).toBe(0)
  }

  /**
   * The page never scrolls, whatever the region inside it is doing. Weaker
   * than `verifyNothingIsScrolled`, deliberately — a short phone with five
   * clips legitimately scrolls the *region* by about 12px, and that is
   * allowed; the page moving is not. `verifyStageIsAFixedFrame` is the
   * stronger form, and says the frame is bounded by the window as well.
   *
   * Delegates rather than reading `scrollHeight` with a `+1` tolerance: a
   * tolerance that can hide a real 1px scroll is precisely what let the laptop
   * band go unnoticed.
   */
  async verifyPageDoesNotScroll(): Promise<void> {
    await this.verifyPageDoesNotMove()
  }

  /** Scroll the frame's own region — which a five-clip song bar can make necessary. */
  async scrollGridRegionToBottom(): Promise<void> {
    await this.stageScroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
  }

  /**
   * Back to the top of both scrollers — the region and the grid's own box.
   * Adding a clip leaves them scrolled, because clicking through the picker
   * scrolls things into view, so a test that means "this is where the layout
   * puts the grid" has to say which scroll position it means rather than
   * inherit whichever one the last interaction happened to leave behind.
   */
  async scrollGridRegionToTop(): Promise<void> {
    await this.stageScroller.evaluate((element) => {
      element.scrollTop = 0
    })
    await this.gridWellScroll.evaluate((element) => {
      element.scrollTop = 0
    })
  }

  /** The other end of the same rule: once the bar is capped, the strip is what gives. */
  async verifyLaneStripIsTheScroller(): Promise<void> {
    const overflow = await this.page
      .getByTestId('phone-song-lanes')
      .evaluate((element) => element.scrollHeight - element.clientHeight)
    expect(overflow).toBeGreaterThan(0)
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

  /**
   * The plain, no-dialog New boop reset (spec §7). It is a top-bar button at
   * ≥1024 and the first entry in the phone's "⋯" menu, where it moved when the
   * transport went (screenspace ticket 03) — so the phone route opens the menu
   * first, exactly as a child would.
   */
  async pressNewBoop(): Promise<void> {
    await this.ensureClipEditorClosed()
    if (await this.isPhoneLayout()) await this.openPhoneMenu()
    await this.newBoopButton.click()
  }

  /** Which chrome is mounted — `useIsPhone`'s answer, read off the DOM. */
  private async isPhoneLayout(): Promise<boolean> {
    return (await this.page.getByTestId('phone-bar').count()) > 0
  }

  clipChip(index: number) {
    return this.page.getByTestId(`clip-chip-${index}`)
  }

  async selectClip(index: number): Promise<void> {
    await this.ensureClipEditorClosed()
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
    await this.ensureClipEditorClosed()
    await this.beginChipDrag(from, to)
    await this.releaseChip()
  }

  /** The drag's first half — pointer down and over the target, held for mid-drag asserts. */
  async beginChipDrag(from: number, to: number): Promise<void> {
    await this.ensureClipEditorClosed()
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
    await this.ensureClipEditorClosed()
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
    await this.ensureClipEditorClosed()
    await this.clipChip(index).press(direction === 'up' ? 'Control+ArrowUp' : 'Control+ArrowDown')
  }

  /** The clip header's name — also the chip's, but the header is the editable one. */
  async verifyActiveClipName(name: string): Promise<void> {
    await expect(this.page.getByTestId('clip-name')).toHaveText(name)
  }

  /** Rename via the pencil: type, Enter commits. */
  async renameActiveClip(name: string): Promise<void> {
    await this.ensureClipEditorOpen()
    await this.page.getByTestId('clip-rename-button').click()
    const input = this.page.getByTestId('clip-rename-input')
    await input.fill(name)
    await input.press('Enter')
  }

  async copyClip(): Promise<void> {
    await this.ensureClipEditorOpen()
    await this.page.getByTestId('clip-copy-button').click()
  }

  async deleteClip(): Promise<void> {
    await this.ensureClipEditorOpen()
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
    await this.ensureClipEditorClosed()
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
   * The right edge of the lane grid's content box — `clientWidth` rather than
   * the bounding rect, so the scrollbar gutter the box reserves is outside it.
   */
  private async laneGridContentRight(): Promise<number> {
    return await this.page.getByTestId('song-lanes').evaluate((box: HTMLElement) => {
      const rect = box.getBoundingClientRect()
      return (
        rect.left +
        box.clientLeft +
        box.clientWidth -
        parseFloat(getComputedStyle(box).paddingRight)
      )
    })
  }

  /**
   * Variant E's fit: chips and "+ New clip" narrow to 128px, and the squares
   * turn flexible — all equal, never wider than the laptop's own 44px square,
   * and compressing towards a 20px floor only as far as the width forces.
   * They used to compress all the way to that floor at every tablet width,
   * because the lane grid took its content's *minimum* width instead of the
   * room the row had; the band now only compresses where 16 x 44px genuinely
   * does not fit. `expectFlush` is that narrow end: the squares and their gaps
   * add up to the column exactly.
   */
  async verifyLaneGridFitsColumn({ expectFlush = false } = {}): Promise<void> {
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
    expect(first.width).toBeLessThanOrEqual(44)
    expect(first.width).toBeGreaterThanOrEqual(20)

    // All 16 the same width as each other, and the row inside the lane grid's
    // content edge — flush with it where the band is compressing.
    const widths = squares.map((box) => box.width)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(0.5)
    const contentRight = await this.laneGridContentRight()
    if (expectFlush) {
      expect(Math.abs(last.x + last.width - contentRight)).toBeLessThanOrEqual(1)
      expect(first.width).toBeLessThan(44)
    } else {
      expect(last.x + last.width).toBeLessThanOrEqual(contentRight + 1)
    }

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
    const scrollers = await this.page.evaluate(
      () =>
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

  /**
   * Speed is in the phone song bar's header (screenspace ticket 02) — the
   * position the laptop `SongBar` already uses. Asserted by place, not by
   * existence: inside the bar, below song play, and above the WHOLE SONG band,
   * so tacking it on under the lanes would not pass.
   */
  async verifySpeedInSongBarHeader(): Promise<void> {
    const inBar = await this.page
      .getByTestId('tempo-slider')
      .evaluate(
        (element, id) => element.closest(`[data-testid="${id}"]`) !== null,
        'phone-song-bar',
      )
    expect(inBar).toBe(true)

    const speed = await this.page.getByTestId('song-speed').boundingBox()
    const play = await this.page.getByTestId('song-play-button').boundingBox()
    const band = await this.page.getByTestId('song-band').boundingBox()
    if (!speed || !play || !band) throw new Error('the phone song bar header is not visible')
    expect(speed.y).toBeGreaterThanOrEqual(play.y)
    expect(speed.y + speed.height).toBeLessThanOrEqual(band.y)
  }

  /**
   * The Speed row fits the bar it moved into: "Fast" inside the bar's box, and
   * a slider track no shorter than the 84px it had in the transport at 360px
   * (measured — the transport gave the tempo block 164px and its endpoints and
   * gaps took 80 of them). Under that and the move has cost the control track.
   */
  async verifySpeedRowFitsSongBar(): Promise<void> {
    const bar = await this.phoneSongBar.boundingBox()
    const fast = await this.page.getByText('Fast', { exact: true }).boundingBox()
    const slider = await this.tempoSlider.boundingBox()
    if (!bar || !fast || !slider) throw new Error('the Speed row is not visible')
    expect(fast.x + fast.width).toBeLessThanOrEqual(bar.x + bar.width)
    expect(slider.width).toBeGreaterThanOrEqual(84)
  }

  /** Nothing inside the phone song bar spills sideways — the Speed slider shrinks. */
  async verifySongBarHasNoOverflow(): Promise<void> {
    const overflow = await this.phoneSongBar.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
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
    await this.ensureClipEditorClosed()
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
    await this.ensureClipEditorClosed()
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
    await this.ensureClipEditorClosed()
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

  // --- The scrub strips (boop-playhead ticket 05, spec §4) ---

  private readonly songStrip = this.page.getByTestId('song-strip')
  private readonly songStripMarker = this.page.getByTestId('song-strip-marker')
  private readonly clipRail = this.page.getByTestId('clip-rail')

  private stripCell(position: number) {
    return this.page.getByTestId(`song-strip-cell-${position}`)
  }

  /**
   * The x of a bar's middle inside a strip cell — the segment a scrub lands in.
   *
   * The strip rides the lane grid inside the dock's scroll box, and a capped
   * dock (ticket 23) can have it scrolled out of view; raw mouse moves do not
   * scroll the way a locator click does, so bring it in first, as a finger
   * would.
   */
  private async barCentre(position: number, bar: number): Promise<{ x: number; y: number }> {
    await this.songStrip.scrollIntoViewIfNeeded()
    const box = await this.stripCell(position).boundingBox()
    if (!box) throw new Error(`song strip cell ${position} is not visible`)
    return { x: box.x + (box.width * (bar + 0.5)) / 4, y: box.y + box.height / 2 }
  }

  /** Tap the song strip on one bar of one position — the whole gesture in one press. */
  async tapSongStrip(position: number, bar = 0): Promise<void> {
    await this.ensureClipEditorClosed()
    const { x, y } = await this.barCentre(position, bar)
    await this.page.mouse.click(x, y)
  }

  /** Press at one point and drag to another without releasing — a continuous scrub. */
  private async dragBetween(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): Promise<void> {
    await this.page.mouse.move(start.x, start.y)
    await this.page.mouse.down()
    await this.page.mouse.move(end.x, end.y, { steps: 8 })
    await this.page.mouse.up()
  }

  async dragSongStrip(
    from: { position: number; bar?: number },
    to: { position: number; bar?: number },
  ): Promise<void> {
    await this.ensureClipEditorClosed()
    await this.dragBetween(
      await this.barCentre(from.position, from.bar ?? 0),
      await this.barCentre(to.position, to.bar ?? 0),
    )
  }

  /** The strip marker's bar, and whether it is the playing or the stopped treatment. */
  async verifySongStripMarkerAt(position: number, bar: number, playing: boolean): Promise<void> {
    await expect(this.songStripMarker).toHaveAttribute('data-position', String(position))
    await expect(this.songStripMarker).toHaveAttribute('data-bar', String(bar))
    await expect(this.songStripMarker).toHaveAttribute('data-playing', String(playing))
  }

  /** A placed cell wears its clip's tint; an empty one is the dimmed treatment. */
  async verifyStripCellPlaced(position: number, placed: boolean): Promise<void> {
    await expect(this.stripCell(position)).toHaveAttribute('data-placed', String(placed))
  }

  /**
   * Cells sit exactly under their ruler numerals and lane squares — the one
   * geometry claim the handoff makes about the strip.
   */
  async verifyStripCellAlignsWithLane(position: number, clipIndex: number): Promise<void> {
    const cell = await this.stripCell(position).boundingBox()
    const square = await this.laneSquare(clipIndex, position).boundingBox()
    const numeral = await this.page.getByTestId(`song-position-numeral-${position}`).boundingBox()
    if (!cell || !square || !numeral) throw new Error('the strip, lane or ruler is not visible')
    expect(Math.abs(cell.x - square.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(cell.width - square.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(cell.x - numeral.x)).toBeLessThanOrEqual(1)
  }

  /** Tap a ruler numeral — a jump to the start of that position. */
  async tapPositionNumeral(position: number): Promise<void> {
    await this.ensureClipEditorClosed()
    await this.page.getByTestId(`song-position-numeral-${position}`).click()
  }

  /** An empty position is not on the timeline, so its numeral is not a jump. */
  async verifyPositionNumeralUnreachable(position: number): Promise<void> {
    await expect(this.page.getByTestId(`song-position-numeral-${position}`)).toBeDisabled()
  }

  /** The numeral of the position the playhead is in, playing or stopped. */
  async verifyPositionNumeralCurrent(position: number, playing: boolean): Promise<void> {
    const numeral = this.page.getByTestId(`song-position-numeral-${position}`)
    await expect(numeral).toHaveAttribute('data-current', 'true')
    await expect(numeral).toHaveAttribute('data-playing', String(playing))
  }

  /** Tap the clip rail on one of its 16 step ticks. */
  async tapClipRail(step: number): Promise<void> {
    await this.ensureClipEditorOpen()
    await this.page.getByTestId(`clip-rail-tick-${step}`).click()
  }

  async dragClipRail(from: number, to: number): Promise<void> {
    await this.ensureClipEditorOpen()
    await this.dragBetween(await this.tickCentre(from), await this.tickCentre(to))
  }

  /** The middle of one of the rail's 16 step ticks. */
  private async tickCentre(step: number): Promise<{ x: number; y: number }> {
    const box = await this.page.getByTestId(`clip-rail-tick-${step}`).boundingBox()
    if (!box) throw new Error(`clip rail tick ${step} is not visible`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  /** The rail's cyan tick, and whether it is the playing or the stopped treatment. */
  async verifyClipRailAtStep(step: number, playing: boolean): Promise<void> {
    const tick = this.page.getByTestId(`clip-rail-tick-${step}`)
    await expect(tick).toHaveAttribute('data-current', 'true')
    await expect(tick).toHaveAttribute('data-playing', String(playing))
    await expect(
      this.page.locator('[data-testid^="clip-rail-tick-"][data-current="true"]'),
    ).toHaveCount(1)
  }

  /** The rail sits on `.steps`' geometry: each tick under its own grid column. */
  async verifyClipRailAlignsWithSteps(step: number): Promise<void> {
    const tick = await this.page.getByTestId(`clip-rail-tick-${step}`).boundingBox()
    const cell = await this.cell('kick', step).boundingBox()
    if (!tick || !cell) throw new Error('the rail tick or the grid cell is not visible')
    expect(Math.abs(tick.x - cell.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(tick.width - cell.width)).toBeLessThanOrEqual(1)
  }

  /** `Position 4 · bar 2 of 4` — the clip header's readout. */
  /**
   * The readout is whole, not ellipsised. It shares `SongBar`'s header with
   * Speed, and the tablet band's header is full — it was cut at 1024 on the
   * shortest string it can hold before its own font size was pinned there.
   */
  async verifyPlayheadReadoutNotTruncated(): Promise<void> {
    const cut = await this.page
      .getByTestId('playhead-readout')
      .evaluate((element) => element.scrollWidth - element.clientWidth)
    expect(cut).toBeLessThanOrEqual(0)
  }

  async verifyPlayheadReadout(text: string): Promise<void> {
    await expect(this.page.getByTestId('playhead-readout')).toHaveText(text)
  }

  /** Arrow keys and Home on either strip (spec §4). */
  async pressOnSongStrip(key: string): Promise<void> {
    await this.ensureClipEditorClosed()
    await this.songStrip.press(key)
  }

  async pressOnClipRail(key: string): Promise<void> {
    await this.ensureClipEditorOpen()
    await this.clipRail.press(key)
  }

  /** Both strips are sliders, with the bar/step they sit on as their value. */
  async verifySongStripSlider(valueNow: number, valueText: string): Promise<void> {
    await expect(this.songStrip).toHaveAttribute('role', 'slider')
    await expect(this.songStrip).toHaveAttribute('aria-valuenow', String(valueNow))
    await expect(this.songStrip).toHaveAttribute('aria-valuetext', valueText)
  }

  async verifyClipRailSlider(valueNow: number, valueText: string): Promise<void> {
    await expect(this.clipRail).toHaveAttribute('role', 'slider')
    await expect(this.clipRail).toHaveAttribute('aria-valuenow', String(valueNow))
    await expect(this.clipRail).toHaveAttribute('aria-valuetext', valueText)
  }

  /**
   * Song play is the song grid's header at every width. It was the laptop
   * bar's own left-hand play *column* until Ed asked for one arrangement
   * across the breakpoints (the phone bar already had it there): the button
   * leads the header row, beside "Your boop" and the bars readout, and the
   * width it used to take is the lane grid's now.
   */
  async verifySongPlayIsTheSongHeader(): Promise<void> {
    const play = await this.songPlayButton.boundingBox()
    const bars = await this.page.getByTestId('song-length').boundingBox()
    if (!play || !bars) throw new Error('the song play button or the bars readout is not visible')
    // The same row as the readout: its centre falls inside the button's band.
    const centre = bars.y + bars.height / 2
    expect(centre).toBeGreaterThanOrEqual(play.y)
    expect(centre).toBeLessThanOrEqual(play.y + play.height)
    // And it leads that row.
    expect(play.x + play.width).toBeLessThanOrEqual(bars.x)
  }

  /**
   * A classic, space-taking vertical scrollbar must not tip the lane grid into
   * scrolling sideways as well. That is the bug: with the lane grid sized to
   * the column almost exactly, the ~15px a macOS "always show scroll bars"
   * vertical bar takes came straight out of the row's width and put a
   * horizontal bar under it. CT's chromium draws overlay scrollbars and so can
   * never reproduce it — the assertion is the slack the bar would need.
   */
  async verifyLaneGridClearsAClassicScrollbar(): Promise<void> {
    const contentRight = await this.laneGridContentRight()
    const last = await this.laneSquare(0, 15).boundingBox()
    if (!last) throw new Error('the last lane square is not visible')
    expect(contentRight - (last.x + last.width)).toBeGreaterThanOrEqual(15)
  }

  /** No needless compression: the squares are only as small as the width forces. */
  async verifyLaneSquareWidthAtLeast(px: number): Promise<void> {
    const square = await this.laneSquare(0, 0).boundingBox()
    if (!square) throw new Error('the lane square is not visible')
    expect(square.width).toBeGreaterThanOrEqual(px)
  }

  async verifyPositionNumeralPlaying(position: number): Promise<void> {
    await expect(this.page.getByTestId(`song-position-numeral-${position}`)).toHaveAttribute(
      'data-playing',
      'true',
    )
  }

  // --- The phone scrub bands (boop-playhead ticket 06, spec §4/§7.2) ---

  private readonly loopMap = this.page.getByTestId('loop-map')
  private readonly songBand = this.page.getByTestId('song-band')
  private readonly songBandMarker = this.page.getByTestId('song-band-marker')

  /**
   * A tap on the loop map band, over one of its 16 ticks. Deliberately the
   * *band's* own y — the handoff's pointer target is the whole band, and a tap
   * that misses the 5px tick must still scrub.
   */
  async tapLoopMap(step: number): Promise<void> {
    await this.ensureClipEditorOpen()
    const { x } = await this.loopTickCentre(step)
    const band = await this.loopMap.boundingBox()
    if (!band) throw new Error('the loop map is not visible')
    await this.page.mouse.click(x, band.y + band.height / 2)
  }

  async dragLoopMap(from: number, to: number): Promise<void> {
    await this.ensureClipEditorOpen()
    await this.dragBetween(await this.loopTickCentre(from), await this.loopTickCentre(to))
  }

  private async loopTickCentre(step: number): Promise<{ x: number; y: number }> {
    const box = await this.page.getByTestId(`loop-tick-${step}`).boundingBox()
    if (!box) throw new Error(`loop tick ${step} is not visible`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  /** The loop map's grip cap, on the step it sits above and its playing treatment. */
  async verifyLoopMapCapAt(step: number, playing: boolean): Promise<void> {
    const cap = this.page.getByTestId('loop-map-cap')
    await expect(cap).toHaveAttribute('data-step', String(step))
    await expect(cap).toHaveAttribute('data-playing', String(playing))
    // And it is centred on that tick, not on a flat 1/16 of the track: the
    // ticks are `flex: 1` on a 4px gap, so the two are ~2px apart.
    const capBox = await cap.boundingBox()
    const tick = await this.page.getByTestId(`loop-tick-${step}`).boundingBox()
    if (!capBox || !tick) throw new Error('the loop map cap or its tick is not visible')
    expect(Math.abs(capBox.x + capBox.width / 2 - (tick.x + tick.width / 2))).toBeLessThanOrEqual(1)
  }

  async verifyLoopMapSlider(valueNow: number, valueText: string): Promise<void> {
    await expect(this.loopMap).toHaveAttribute('role', 'slider')
    await expect(this.loopMap).toHaveAttribute('aria-valuenow', String(valueNow))
    await expect(this.loopMap).toHaveAttribute('aria-valuetext', valueText)
  }

  async pressOnLoopMap(key: string): Promise<void> {
    await this.ensureClipEditorOpen()
    await this.loopMap.press(key)
  }

  /** The x of one global bar's middle on the WHOLE SONG band's continuous track. */
  private async songBandBarCentre(
    globalBar: number,
    barCount: number,
  ): Promise<{ x: number; y: number }> {
    const box = await this.songBand.boundingBox()
    if (!box) throw new Error('the song band is not visible')
    return {
      x: box.x + (box.width * (globalBar + 0.5)) / barCount,
      y: box.y + box.height / 2,
    }
  }

  /** Tap the WHOLE SONG band on one global bar of a `barCount`-bar song. */
  async tapSongBand(globalBar: number, barCount: number): Promise<void> {
    await this.ensureClipEditorClosed()
    const { x, y } = await this.songBandBarCentre(globalBar, barCount)
    await this.page.mouse.click(x, y)
  }

  async dragSongBand(from: number, to: number, barCount: number): Promise<void> {
    await this.ensureClipEditorClosed()
    await this.dragBetween(
      await this.songBandBarCentre(from, barCount),
      await this.songBandBarCentre(to, barCount),
    )
  }

  /** The band's marker: the global bar it sits on, and its playing treatment. */
  async verifySongBandMarkerAt(globalBar: number, playing: boolean): Promise<void> {
    await expect(this.songBandMarker).toHaveAttribute('data-bar', String(globalBar))
    await expect(this.songBandMarker).toHaveAttribute('data-playing', String(playing))
  }

  /**
   * One segment per *placed* position (spec §7.2), each wearing its topmost
   * clip's tint — so the count follows a placement change.
   */
  async verifySongBandSegments(tints: number[]): Promise<void> {
    const segments = this.page.locator('[data-testid^="song-band-segment-"]')
    await expect(segments).toHaveCount(tints.length)
    for (const [index, tint] of tints.entries()) {
      await expect(segments.nth(index)).toHaveAttribute('data-tint', String(tint))
    }
  }

  /**
   * The marker is one bar of the song's real length, and it sits on the segment
   * holding that bar: the derived geometry's one arithmetic claim (spec §7.2).
   */
  async verifySongBandMarkerOnSegment(globalBar: number, barCount: number): Promise<void> {
    const marker = await this.songBandMarker.boundingBox()
    const band = await this.songBand.boundingBox()
    if (!marker || !band) throw new Error('the song band or its marker is not visible')
    expect(Math.abs(marker.width - band.width / barCount)).toBeLessThanOrEqual(1)
    expect(Math.abs(marker.x - (band.x + (band.width * globalBar) / barCount))).toBeLessThanOrEqual(
      1,
    )
  }

  async verifySongBandCapAt(globalBar: number, playing: boolean): Promise<void> {
    const cap = this.page.getByTestId('song-band-cap')
    await expect(cap).toHaveAttribute('data-bar', String(globalBar))
    await expect(cap).toHaveAttribute('data-playing', String(playing))
  }

  async verifySongBandSlider(valueNow: number, valueText: string): Promise<void> {
    await expect(this.songBand).toHaveAttribute('role', 'slider')
    await expect(this.songBand).toHaveAttribute('aria-valuenow', String(valueNow))
    await expect(this.songBand).toHaveAttribute('aria-valuetext', valueText)
  }

  async pressOnSongBand(key: string): Promise<void> {
    await this.ensureClipEditorClosed()
    await this.songBand.press(key)
  }

  /** `Position 4 · bar 2 of 4` — the phone's readout, on the band's caption row. */
  async verifyPhonePlayheadReadout(text: string): Promise<void> {
    await expect(this.page.getByTestId('phone-playhead-readout')).toHaveText(text)
  }

  /**
   * The band stays exactly where it was while the surface under it swipes —
   * the grid's step window for the loop map, the lane strip for the WHOLE SONG
   * band. One band at a time, for the same reason as the two helpers above.
   */
  async verifyBandDoesNotScroll(band: 'loop' | 'song', swipeBy: number): Promise<void> {
    const locator = band === 'loop' ? this.loopMap : this.songBand
    if (band === 'loop') await this.ensureClipEditorOpen()
    else await this.ensureClipEditorClosed()
    const before = await locator.boundingBox()
    if (band === 'loop') await this.swipeSteps(swipeBy)
    else await this.swipeLanes(swipeBy)
    const after = await locator.boundingBox()
    if (!before || !after) throw new Error('a scrub band is not visible')
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1)
  }

  /**
   * A drag *down* a band, the gesture a child makes to scroll the page. The
   * band must move nothing: only a sideways drag is a scrub (`useScrubDrag`'s
   * deferred mode), because on real touch hardware this one belongs to the
   * scrolling region and arrives as `pointermove`s before `pointercancel`.
   */
  async dragDownBand(band: 'loop' | 'song'): Promise<void> {
    if (band === 'loop') await this.ensureClipEditorOpen()
    else await this.ensureClipEditorClosed()
    const box = await (band === 'loop' ? this.loopMap : this.songBand).boundingBox()
    if (!box) throw new Error('a scrub band is not visible')
    const x = box.x + box.width * 0.8
    const y = box.y + box.height / 2
    await this.dragBetween({ x, y }, { x, y: y - 120 })
  }

  /**
   * The bands must not take vertical panning away from the scroller they sit
   * in (ADR 0027/0030): `pan-y` rather than the handoff's `none`, which would
   * trap a finger that lands on the band.
   *
   * One band at a time since screenspace ticket 03: the loop map is inside the
   * clip editor card and the WHOLE SONG band is on the song bar behind it, so
   * they are never on screen together and a helper that read both would have
   * to open and close the card between its two halves. These two read whatever
   * is on screen — the caller says which surface it is on.
   */
  async verifyBandAllowsVerticalScroll(band: 'loop' | 'song'): Promise<void> {
    const touchAction = await (band === 'loop' ? this.loopMap : this.songBand).evaluate(
      (element) => getComputedStyle(element).touchAction,
    )
    expect(touchAction).toBe('pan-y')
  }

  /** The cap clears a 44px touch target through its band's own hit area. */
  async verifyBandTapTarget(band: 'loop' | 'song'): Promise<void> {
    const box = await (band === 'loop' ? this.loopMap : this.songBand).boundingBox()
    if (!box) throw new Error('a scrub band is not visible')
    expect(box.height).toBeGreaterThanOrEqual(44)
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
