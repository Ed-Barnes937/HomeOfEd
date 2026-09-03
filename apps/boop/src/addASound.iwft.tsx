import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import { SAVE_KEY } from './persistence/storage.ts'
import { test } from './testing/iwftTest.tsx'

// "+ Add a sound" and the geometry a growing clip needs (boop-instruments
// ticket 06, spec §4/§10.2): the button under the last row, inside the well's
// rows box; more rows grow the well and the existing scrollers absorb them; and
// playback still never moves a row out from under a child - ADR 0027's rule on
// the vertical axis (ADR 0042).
//
// Runs at the default 1280x720 CT viewport except where a describe says
// otherwise; the phone pass is at the bottom.

/** The launch clip's rows, in kit order - what `blankPattern` gives a fresh clip. */
const SIX = ['kick', 'snare', 'hat', 'tom', 'marimba', 'boop']

/**
 * Twelve of the roster's twenty, in manifest order: the row count the ticket
 * names, and twice the six every layout was drawn for.
 */
const TWELVE = [...SIX, 'clap', 'shaker', 'cowbell', 'woodblock', 'triangle', 'cymbal']

/** The whole roster (ADR 0042) - a clip's ceiling, where nothing is left to add. */
const ROSTER = [...TWELVE, 'bass', 'bell', 'chime', 'pluck', 'boing', 'pop', 'zap', 'drip']

const EMPTY = '0'.repeat(16)

/**
 * Seed a working clip of these rows. Seeded after a reload, because the
 * outgoing page flushes its pending autosave on the way out (grid.iwft) - and
 * because a twelve-row clip is quicker to arrive at than twelve taps.
 */
const seedRows = async (
  page: Page,
  rows: readonly string[],
  painted: Record<string, string> = {},
) => {
  await page.reload()
  await page.evaluate(({ key, doc }) => window.localStorage.setItem(key, JSON.stringify(doc)), {
    key: SAVE_KEY,
    doc: {
      version: 1,
      working: {
        name: '',
        kitId: 'launch',
        tempo: 120,
        patterns: [
          {
            rows: rows.map((instrumentId) => ({
              instrumentId,
              steps: painted[instrumentId] ?? EMPTY,
            })),
          },
        ],
      },
      creations: [],
    },
  })
}

test('"+ Add a sound" appends the sound at the bottom, and closes on the tap', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyGridRows(SIX)
  await root.verifyGridRowCountAnnounced(6)

  // Append mode is the same dialog, one decision (spec §4): no "Remove this
  // row" footer, the clip's own sounds disabled, and a title of its own.
  await root.openAddSoundPicker()
  await root.verifyInstrumentPickerLabelled('Add a sound')
  await root.verifyRemoveRowAbsent()
  await root.verifyInstrumentEntryDisabled('kick', 'Kick')
  await root.verifyInstrumentEntryEnabled('cowbell')

  await root.chooseInstrument('cowbell')
  await root.verifyInstrumentPickerClosed()

  await root.verifyGridRows([...SIX, 'cowbell'])
  await root.verifyGridRowCountAnnounced(7)
  // The new row arrives empty and paintable, at the bottom.
  await root.verifyCellOff('cowbell', 0)
  await root.toggleCell('cowbell', 4)
  await root.verifyCellOn('cowbell', 4)
})

test('rows seven and eight cycle the six hues, and a delete recolours the rows below', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.addSound('clap')
  await root.addSound('shaker')
  await root.verifyGridRows([...SIX, 'clap', 'shaker'])

  const eight = await root.readRowHues()
  expect(new Set(eight.slice(0, 6)).size).toBe(6)
  expect(eight[6]).toBe(eight[0])
  expect(eight[7]).toBe(eight[1])

  // Deleting a row recolours the rows below it (spec §10.2, accepted): the
  // palette down the grid is unchanged, so each surviving row wears the hue of
  // the position it now holds rather than the one it had.
  await root.openRowInstrumentPicker('kick')
  await root.removeThisRow()
  await root.verifyGridRows(['snare', 'hat', 'tom', 'marimba', 'boop', 'clap', 'shaker'])

  const seven = await root.readRowHues()
  expect(seven).toEqual(eight.slice(0, 7))
  await root.verifyGridRowCountAnnounced(7)
})

test('at the whole roster there is no sound left to add', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await seedRows(page, ROSTER)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()

  await root.verifyGridRows(ROSTER)
  await root.verifyGridRowCountAnnounced(ROSTER.length)
  await root.verifyAddSoundDisabled()
})

test('arrow keys walk every row of a twelve-row clip', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await seedRows(page, TWELVE)

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()

  await root.focusCell('kick', 0)
  for (let i = 0; i < TWELVE.length - 1; i += 1) await root.pressArrowKey('ArrowDown')
  await root.verifyCellFocused('cymbal', 0)
})

/**
 * The vertical half of ADR 0027's promise (ADR 0042): the loop map carries the
 * playhead when a *step* is off screen, and nothing at all happens when a
 * *row* is - a child's scroll position is theirs. Twelve rows at 720px is the
 * cheapest way to have a row off the bottom of the well.
 */
test('playback never scrolls a row into view', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  // The last row is the only one carrying notes, so the playhead is striking a
  // row that is off screen for the whole loop.
  await seedRows(page, TWELVE, { cymbal: '1111111111111111' })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()
  await root.scrollGridRegionToTop()
  await expect(root.cell('cymbal', 0)).not.toBeInViewport()

  await root.pressWellClipPlay()
  await root.verifyPlaybackDoesNotScrollVertically(16)

  // Playback really ran, and the row really is still off screen.
  await root.verifyPlayheadAtStep(15)
  await expect(root.cell('cymbal', 0)).not.toBeInViewport()
})

test.describe('twelve rows on the laptop', () => {
  test('the rows scroll inside the well, the add button with them, clip play pinned', async ({
    mountApp,
    page,
  }) => {
    const first = await mountApp()
    await first.root.verifyIsShown()
    await seedRows(page, TWELVE)

    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()
    await root.scrollGridRegionToTop()

    // The nested rows scroller ADR 0030 already sanctions is what absorbs the
    // rows: no new scroller, and the page still does not move.
    await root.verifyGridWellIsTheScroller()
    await root.verifyPageDoesNotScroll()
    await root.verifyAddSoundScrollsWithTheRows()
    await root.verifyClipPlayInWellIsReachable()

    // And the button still works from down there.
    await root.addSound('bass')
    await root.verifyGridRows([...TWELVE, 'bass'])
    await root.verifyGridRowCountAnnounced(13)
  })

  test.describe('on a tall window', () => {
    test.use({ viewport: { width: 1280, height: 1000 } })

    test('nothing stretches the grid', async ({ mountApp, page }) => {
      const first = await mountApp()
      await first.root.verifyIsShown()
      await seedRows(page, TWELVE)

      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.openClipEditor()

      await root.verifyWellHugsItsRows()
      await root.verifyClipPlayInWellIsReachable()
      await root.verifyPageDoesNotScroll()
    })
  })
})

test.describe('the phone, where the rail is pinned', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the rail and the step window gain rows together, and the region pays', async ({
    mountApp,
    page,
  }) => {
    const first = await mountApp()
    await first.root.verifyIsShown()
    await seedRows(page, TWELVE)

    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPhoneChromeShown()
    await root.openClipEditor()

    await root.verifyGridRows(TWELVE)
    await root.verifyRailAlignedWithSteps(TWELVE)
    await root.verifyPageDoesNotScroll()
    await root.verifyNoHorizontalOverflow()

    // The phone reaches the same button, under the last row.
    await root.addSound('bass')
    await root.verifyGridRows([...TWELVE, 'bass'])
    await root.verifyRailAlignedWithSteps([...TWELVE, 'bass'])
    await root.verifyClipPlayInWellIsReachable()
  })

  test.describe('on a short phone, where the page used to scroll', () => {
    test.use({ viewport: { width: 390, height: 500 } })

    test('twelve rows still cost the page nothing', async ({ mountApp, page }) => {
      const first = await mountApp()
      await first.root.verifyIsShown()
      await seedRows(page, TWELVE)

      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.openClipEditor()

      // The retired 505px exception stays retired (screenspace ticket 04):
      // the well's own box takes the rows and the page does not move.
      await root.verifyGridWellIsTheScroller()
      await root.verifyPageDoesNotScroll()
      await root.verifyClipPlayInWellIsReachable()
      await root.verifyAddSoundOffered()
    })
  })
})
