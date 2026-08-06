import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import type { PlayedSample } from '../engine/testing/fakeAudioDriver.ts'
import { parseSaveDocument, type StoredCreation } from '../persistence/saveFormat.ts'
import { SAVE_KEY } from '../persistence/storage.ts'
import { BOOP_AUDIO_DRIVER_KEY } from './gridProtocol.ts'

/** The root page object for boop's grid app — tap cells, play/pause, and drive the fake audio clock. */
export class HomePagePom extends BasePage {
  private readonly playButton = this.page.getByTestId('play-button')
  private readonly tempoSlider = this.page.getByTestId('tempo-slider')
  private readonly tempoReadout = this.page.getByTestId('tempo-readout')
  private readonly clearGridButton = this.page.getByTestId('clear-grid-button')
  private readonly confirmSafeButton = this.page.getByTestId('confirm-safe-button')
  private readonly confirmDestructiveButton = this.page.getByTestId('confirm-destructive-button')
  private readonly shareButton = this.page.getByTestId('share-button')

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByText('boop', { exact: true })).toBeVisible()
    await expect(this.page.getByRole('application')).toBeVisible()
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

  presetCard(presetId: string) {
    return this.page.getByTestId(`preset-card-${presetId}`)
  }

  async loadPreset(presetId: string): Promise<void> {
    await this.presetCard(presetId).click()
  }

  async verifyPresetLoaded(presetId: string): Promise<void> {
    await expect(this.presetCard(presetId)).toHaveAttribute('data-active', 'true')
  }

  async verifyPresetNotLoaded(presetId: string): Promise<void> {
    await expect(this.presetCard(presetId)).toHaveAttribute('data-active', 'false')
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
  async readAutosavedGrid(): Promise<StoredCreation | null> {
    const raw = await this.page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY)
    return parseSaveDocument(raw).working
  }

  /** The "My grooves" list — separate from the working grid a preset load may replace. */
  async readSavedCreations(): Promise<readonly StoredCreation[]> {
    const raw = await this.page.evaluate((key) => window.localStorage.getItem(key), SAVE_KEY)
    return parseSaveDocument(raw).creations
  }

  /**
   * Wait for the debounced autosave to reach localStorage with a given cell on
   * — asserting on content, not merely on the slot existing, so the wait cannot
   * be satisfied by an earlier write of a grid that predates the edit.
   */
  async waitForAutosavedCell(instrumentId: string, step: number): Promise<void> {
    await expect
      .poll(async () => {
        const working = await this.readAutosavedGrid()
        const row = working?.patterns[0]?.rows.find((r) => r.instrumentId === instrumentId)
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

  // --- Small-phone layout (ticket 27) ---

  private readonly phoneMenuButton = this.page.getByTestId('phone-menu-button')

  stepWindow() {
    return this.page.getByTestId('phone-step-window')
  }

  async verifyPhoneChromeShown(): Promise<void> {
    await expect(this.page.getByTestId('phone-bar')).toBeVisible()
    // The desktop chrome's ghost/primary buttons are simply not mounted.
    await expect(this.page.getByRole('button', { name: 'My grooves' })).toHaveCount(0)
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
    const box = await this.stepWindow().boundingBox()
    if (!box) throw new Error('the phone step window is not visible')
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
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

  /** Assert the samples the fake driver has been told to play, in call order. */
  async verifyPlayed(expected: PlayedSample[]): Promise<void> {
    const played = await this.page.evaluate((key) => {
      const driver = (globalThis as unknown as Record<string, { played: PlayedSample[] }>)[key]!
      return driver.played
    }, BOOP_AUDIO_DRIVER_KEY)
    expect(played).toEqual(expected)
  }
}
