import { test } from './testing/iwftTest.tsx'

// Ticket 23: the play bar never scrolls away. The clip play button (the well's
// footer at >=1024) and the song play button (the phone song bar's header) are
// on screen at every width and every window height — when there is not enough
// room the *grid* scrolls, inside its own well, and the bar stays put.
//
// Every viewport here is deliberately short, so the stack genuinely does not
// fit and something has to give; on a tall window nothing moves and the suite
// would pass against the old layout too.

test.describe('laptop, short window', () => {
  test.use({ viewport: { width: 1280, height: 600 } })

  test('the clip play button is on screen, with nothing scrolled', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    // The whole complaint in one assertion: play this clip is right there.
    await root.verifyClipPlayFullyInViewport()
    await root.verifyNothingIsScrolled()
    // And it stays there once the child has scrolled the grid.
    await root.scrollGridWellToBottom()
    await root.verifyClipPlayFullyInViewport()
  })

  test('the well scrolls, not the frame — the grid region and the page stay put', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyGridWellIsTheScroller()
  })

  test('the grid is still 6 x 16, at the laptop cell geometry', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyGridIsSixBySixteen()
    await root.verifyCellGeometry(62, 66)
  })

  test('the playhead column lands on its step, scrolled well or not', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.pressPlay()
    await root.verifyPlaying()
    await root.crankSteps(1)
    await root.verifyPlayheadAtStep(0)
    await root.verifyPlayheadCoversCell('kick', 0)

    await root.crankSteps(5)
    await root.verifyPlayheadAtStep(5)
    await root.verifyPlayheadCoversCell('kick', 5)

    // A scrolled well must not leave the column behind or clip it off: the
    // bottom row is what a child sees once the well is scrolled down.
    await root.scrollGridWellToBottom()
    await root.verifyPlayheadCoversCell('boop', 5)
  })
})

test.describe('tablet band, short window', () => {
  test.use({ viewport: { width: 1100, height: 600 } })

  test('the clip play button is on screen here too', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyClipPlayFullyInViewport()
    await root.verifyNothingIsScrolled()
  })

  test('the grid is still 6 x 16, at the tablet cell geometry', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyGridIsSixBySixteen()
    await root.verifyCellGeometry(42, 50)
  })

  test('the playhead column lands on its step at the tablet numbers too', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.pressPlay()
    await root.verifyPlaying()
    await root.crankSteps(1)
    await root.verifyPlayheadCoversCell('kick', 0)

    await root.crankSteps(9)
    await root.verifyPlayheadAtStep(9)
    await root.verifyPlayheadCoversCell('kick', 9)

    await root.scrollGridWellToBottom()
    await root.verifyPlayheadCoversCell('boop', 9)
  })
})

test.describe('small phone, short window', () => {
  test.use({ viewport: { width: 390, height: 640 } })

  test('the song play button is on screen, with nothing scrolled', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPhoneChromeShown()

    await root.verifySongPlayFullyInViewport()
    await root.verifyNothingIsScrolled()
    // The pinned transport's clip play is the other half of the same promise.
    await root.verifyTransportFullyInViewport()
  })

  test('the lane strip scrolls under a header that stays put', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifySongPlayOutsideTheLaneScroller()
  })

  test('the grid is still 6 x 16, at the phone cell geometry', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyGridIsSixBySixteen()
    await root.verifyCellGeometry(32, 44)
  })
})
