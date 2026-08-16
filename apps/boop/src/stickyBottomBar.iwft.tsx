import { test } from './testing/iwftTest.tsx'

// Ticket 33: the stage is a fixed-height frame — chrome pinned at the top,
// transport pinned at the bottom, the grid well the only scrolling region.
// Both viewports here are deliberately *short*, so the grid genuinely does not
// fit and something has to scroll; on a tall window nothing would move and the
// suite would pass against the old page-scrolling layout too.

test.describe('laptop, short window', () => {
  test.use({ viewport: { width: 1440, height: 700 } })

  test('the transport stays pinned while the grid scrolls under it', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyGridWellIsTheScroller()
    await root.verifyTransportFullyInViewport()
    await root.verifyTopBarFullyInViewport()

    await root.scrollGridWellToBottom()

    // The whole complaint in one assertion: the play button is still there.
    await root.verifyTransportFullyInViewport()
    await root.verifyTopBarFullyInViewport()
  })

  test('play still works with the grid scrolled to the bottom', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.scrollGridWellToBottom()
    await root.pressPlay()
    await root.verifyPlaying()
  })
})

test.describe('small phone, short window', () => {
  // 360 wide: the narrowest phone the design covers. 560 tall rather than 640
  // since ticket 36 — with the preset row off the main screen the grid fits a
  // 640px window, and a suite about scrolling has to be given something that
  // genuinely does not fit.
  test.use({ viewport: { width: 360, height: 560 } })

  test('the phone gets the same frame — strip and transport pinned, grid scrolling between', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPhoneChromeShown()

    await root.verifyGridWellIsTheScroller()
    await root.scrollGridWellToBottom()

    await root.verifyTransportFullyInViewport()
    await root.verifyTopBarFullyInViewport()
    await root.verifyNoHorizontalOverflow()
  })

  test('the tempo block shrinks rather than pushing the bar wider than the phone', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    // The `<input type="range">` keeps its intrinsic width unless it is told it
    // may shrink, which is what overflowed the bar at 360px (ticket 37).
    await root.verifyTransportHasNoOverflow()
  })

  test('ADR 0027 still holds inside the scrolling frame — snap, paint, and the loop map', async ({
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

    // Drag-paint is not stolen by the new vertical scroller.
    await root.swipeSteps(-300)
    await root.verifyStepWindowAt(0)
    await root.dragPaint('kick', [0, 1, 2, 3])
    await root.verifyCellOn('kick', 0)
    await root.verifyCellOn('kick', 3)
    await root.verifyStepWindowAt(0)

    await root.verifyLoopMapCoversWholeLoop()
  })

  test('the loop map scrolls with the grid rather than joining the pinned bar', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyLoopMapInsideGridRegion()
  })
})
