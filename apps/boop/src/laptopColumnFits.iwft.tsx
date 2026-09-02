import { test } from './testing/iwftTest.tsx'

// The laptop column fits its own breakpoint (ADR 0033). The laptop number set
// starts at 1280, and its column used to want a 1420px viewport — so every
// window from 1280 to 1419 scrolled the grid well and the lane grid sideways
// once ticket 23 gave each of them a scroll box. The tablet band already has
// this coverage (`tabletLanes.iwft.tsx`); the laptop band never did, which is
// how the mismatch survived. 1280 is the width that failed hardest, and 1366
// is the commonest laptop inside the old band.

test.describe('1280 — the first width the laptop numbers claim', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('nothing scrolls sideways, and the grid is still 6 x 16', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyNoSidewaysScroller()

    await root.openClipEditor()
    await root.verifyGridIsSixBySixteen()
    await root.verifyCellGeometry(52, 56)
    // The card contains the fixed-geometry column, so the overlay's gutter and
    // the card's padding together have to come to the frame's own — 1280 is
    // the width ADR 0033 exists to make fit, and a dialog-sized gutter left
    // the well 8px short of it.
    await root.verifyCardHoldsTheColumn()
    await root.verifyGridWellHasNoSidewaysScroll()
    await root.verifyNoSidewaysScroller()
  })

  test('the lane grid fits too, at the five-clip cap', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.startBlank()

    // The lane grid is the widest row in the song bar, and adding clips is what
    // grows it — the cap is where the fit is tightest.
    await root.addClip()
    await root.addClip()
    await root.addClip()
    await root.addClip()
    await root.verifyClipCount(5)

    await root.verifyNoSidewaysScroller()
  })
})

test.describe('1366 — inside the old scrolling band', () => {
  test.use({ viewport: { width: 1366, height: 900 } })

  test('nothing scrolls sideways here either', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyNoSidewaysScroller()
  })
})

test.describe('a vertical scrollbar must not start a sideways one', () => {
  // Ed's bug: on macOS with "always show scroll bars", the lane grid's own
  // vertical scrollbar took ~15px out of a row sized to the column almost
  // exactly, and a horizontal bar appeared under it. 700px tall with the five
  // clips is where the lane grid scrolls vertically.
  test.use({ viewport: { width: 1280, height: 700 } })

  test('the lane grid keeps a classic scrollbar of slack', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.startBlank()
    await root.addClip()
    await root.addClip()
    await root.addClip()
    await root.addClip()

    await root.verifyLaneGridClearsAClassicScrollbar()
    await root.verifyNoSidewaysScroller()
  })
})

// 1024 — the tablet band's narrow end, and the other width where the card's
// horizontal budget binds. The frame spends 26px a side here; the card has to
// spend the same between its overlay gutter and its own padding.
test.describe('1024 — the tablet band’s narrow end', () => {
  test.use({ viewport: { width: 1024, height: 900 } })

  test('the card gives the grid what the frame gave it', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyNoSidewaysScroller()

    await root.openClipEditor()
    await root.verifyCardHoldsTheColumn()
    await root.verifyGridWellHasNoSidewaysScroll()
    await root.verifyGridIsSixBySixteen()
  })
})
