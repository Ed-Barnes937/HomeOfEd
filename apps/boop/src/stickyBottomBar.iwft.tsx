import { test } from './testing/iwftTest.tsx'

// Ticket 33: the stage is a fixed-height frame — chrome pinned at the top, the
// dock pinned at the bottom, one scrolling region between them. Screenspace
// ticket 03 changed what stands in each: the song bar is the region's content
// and the dock holds the clip launcher, so the frame's promise is now about
// those two rather than about the grid and the transport.
//
// Both viewports here are deliberately *short*, so something genuinely does not
// fit and has to scroll; on a tall window nothing would move and the suite
// would pass against a page-scrolling layout too.

test.describe('laptop, short window', () => {
  test.use({ viewport: { width: 1440, height: 700 } })

  test('the dock stays pinned while the song bar fills the region', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifySongBarIsTheHomeSurface()
    await root.verifyLauncherFullyInViewport()
    await root.verifyTopBarFullyInViewport()
    // The region has nothing to scroll: the song bar's lane grid is what gives
    // way, in its own box, so the frame holds without the page moving.
    await root.verifyNothingIsScrolled()
  })

  test('the grid scrolls inside the card, and the page still does not move', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    await root.verifyGridWellIsTheScroller()
    await root.scrollGridWellToBottom()
    await root.verifyPageDoesNotScroll()
    // The well footer's clip play is still there once the rows have scrolled —
    // it is pinned under them, not carried by them.
    await root.verifyNotOccluded('play-button')
  })

  test('play still works with the grid scrolled to the bottom', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    // The well's own footer, which is what a child reaches without leaving the
    // grid they have just scrolled.
    await root.scrollGridWellToBottom()
    await root.pressWellClipPlay()
    await root.verifyPlaying()

    // And the launcher outside the card agrees, and stops it.
    await root.closeClipEditor()
    await root.pressPlay()
    await root.verifyPaused()
  })
})

test.describe('small phone, short window', () => {
  // 360 wide: the narrowest phone the design covers. 560 tall rather than 640
  // since ticket 36 — with the preset row off the main screen the grid fits a
  // 640px window, and a suite about scrolling has to be given something that
  // genuinely does not fit.
  test.use({ viewport: { width: 360, height: 560 } })

  test('the phone gets the same frame — strip and dock pinned, song bar between', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPhoneChromeShown()

    await root.verifySongBarIsTheHomeSurface()
    await root.verifyLauncherFullyInViewport()
    await root.verifyTopBarFullyInViewport()
    await root.verifyNoHorizontalOverflow()
  })

  test('the Speed slider shrinks rather than pushing its bar wider than the phone', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    // The `<input type="range">` keeps its intrinsic width unless it is told it
    // may shrink, which is what overflowed the transport at 360px (ticket 37).
    // Speed is in the song bar now (screenspace ticket 02) and took the rule
    // with it; the launcher is checked as well, since a long clip name is the
    // same class of problem.
    await root.verifySongBarHasNoOverflow()
    await root.verifyLauncherHasNoOverflow()
  })

  test('ADR 0027 still holds inside the card — snap, paint, and the loop map', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    // A fresh browser is seeded with a sample clip (tickets 36/17) with cells
    // already on; this test paints its own cells, so start from Blank.
    await root.startBlank()

    // The step window is still its own horizontal scroller, snapping to bar lines.
    await root.verifyStepWindowAt(0)
    await root.swipeSteps(300)
    await root.verifyStepWindowAt(308)
    await root.verifyLoopWindowBracketAt(50)

    await root.toggleCell('hat', 9)
    await root.verifyCellOn('hat', 9)
    await root.verifyLoopTick(9, 'note')

    // Drag-paint is not stolen by the card's own layout.
    await root.swipeSteps(-300)
    await root.verifyStepWindowAt(0)
    await root.dragPaint('kick', [0, 1, 2, 3])
    await root.verifyCellOn('kick', 0)
    await root.verifyCellOn('kick', 3)
    await root.verifyStepWindowAt(0)

    await root.verifyLoopMapCoversWholeLoop()
  })

  test('the loop map stays glued under the grid, inside the well', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    // ADR 0027's rule survives the move into the card: the map belongs to the
    // grid, never to a pinned bar — and the dock is a bar it could have joined.
    await root.verifyLoopMapInsideGridWell()
  })
})
