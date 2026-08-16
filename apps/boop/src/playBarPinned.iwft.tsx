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
    // Here the stronger claim does hold: the well swallows the whole squeeze,
    // so neither the region nor the page has anything to scroll.
    await root.verifyNothingIsScrolled()
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

// The column fits whole at 1440, so the well's scroll box has no business
// scrolling sideways — which makes this the width where the playhead column's
// 8px overhang shows up if `.wellScroll`'s padding stops holding it. Step 15
// is the only step that puts the overhang past the last cell.
test.describe('laptop, the whole column', () => {
  test.use({ viewport: { width: 1440, height: 700 } })

  test('the playhead at the last step does not push the well sideways', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyGridWellHasNoSidewaysScroll()

    await root.pressPlay()
    await root.verifyPlaying()
    await root.crankSteps(16)
    await root.verifyPlayheadAtStep(15)
    await root.verifyPlayheadCoversCell('kick', 15)
    await root.verifyGridWellHasNoSidewaysScroll()

    await root.scrollGridWellToBottom()
    await root.verifyPlayheadCoversCell('boop', 15)
    await root.verifyGridWellHasNoSidewaysScroll()
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

  test('the grid gives up its slack before the lane strip gives up any', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    // The default first-run screen: one clip, and its lane row whole. The grid
    // is what is short here — it still has 152px of content it is not showing,
    // but it is well clear of its floor.
    await root.verifyLaneStripWhole()
    await root.verifyGridWellIsTheScroller()
    await root.verifyGridFloor(2)
  })

  // `phoneLanes.iwft.tsx` runs at 390x844; this is the same interaction on a
  // window short enough that the grid is scrolling. The strip itself is whole
  // here — the squeezed-strip case is the five-lane describe below.
  test('placing and painting a lane still works on a short window', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.startBlank()

    await root.toggleLaneSquare(0, 0)
    await root.verifyPlacementOn(0, 0)
    await root.verifySongLength('4 bars')
    await root.toggleLaneSquare(0, 0)
    await root.verifyPlacementOff(0, 0)

    await root.dragPaintLanes(0, [1, 2, 3])
    await root.verifyPlacementOn(0, 1)
    await root.verifyPlacementOn(0, 3)
    // Painting is not scrolling, on either axis: the strip did not move.
    await root.verifyLaneWindowAt(0)
    await root.verifyLaneStripWhole()
  })

  test('the grid is still 6 x 16, at the phone cell geometry', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyGridIsSixBySixteen()
    await root.verifyCellGeometry(32, 44)
  })
})

// The hardest screen boop has: five lanes on a 460px window. Everything is
// competing at once — the bar is taller than the whole region so its
// `max-height` caps it, the grid is on its floor, and the region itself has to
// scroll. All three promises have to survive that simultaneously.
test.describe('small phone, a window too short for five lanes', () => {
  test.use({ viewport: { width: 390, height: 460 } })

  async function fiveClips(root: {
    startBlank: () => Promise<void>
    addClip: () => Promise<void>
    verifyClipCount: (count: number) => Promise<void>
  }) {
    await root.startBlank()
    await root.addClip()
    await root.addClip()
    await root.addClip()
    await root.addClip()
    await root.verifyClipCount(5)
  }

  test('a capped bar loses lane rows to a scroll, never the song play button', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await fiveClips(root)

    await root.verifyLaneStripIsTheScroller()
    await root.verifySongPlayFullyInViewport()
    await root.verifyTransportFullyInViewport()
  })

  test('the grid keeps its two rows, and song play stays reachable to pay for them', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await fiveClips(root)

    // The floor. Without it this screen showed no grid at all.
    await root.verifyGridFloor(2)

    // The floor is paid for by the region scrolling, and that is what could
    // take song play back off the screen — so both ends of that scroll are
    // checked, and by occlusion rather than by viewport intersection: the
    // pinned chrome would sit *over* the header while `toBeInViewport` still
    // called it visible.
    await root.verifySongPlayFullyInViewport()
    await root.verifyNotOccluded('song-play-button')

    await root.scrollGridRegionToBottom()
    await root.verifyGridFloor(2)
    await root.verifySongPlayFullyInViewport()
    await root.verifyNotOccluded('song-play-button')
    await root.verifyTransportFullyInViewport()
  })
})
