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

// The song bar grows with the song, and until ticket 23 the dock it sits in
// was `flex: none` — so at the five-clip cap it took 476 of 600px and left the
// grid 16px, with the clip control drawn over the bar and eating its taps. The
// dock is capped now, and these are the states that has to hold in: one clip
// and five, at both laptop heights and in the tablet band. `elementFromPoint`,
// not viewport intersection, because "drawn but covered" was the old failure.
test.describe('the five-clip cap', () => {
  // The laptop floor, from `Grid.module.scss`: the bar-numeral row (15 + 8)
  // and two 66px rows with their 10px gap.
  const LAPTOP_FLOOR = 15 + 8 + 2 * 66 + 10

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

  test.describe('1280x600', () => {
    test.use({ viewport: { width: 1280, height: 600 } })

    test('clip play survives one clip and five, and the grid keeps its floor', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.verifyNotOccluded('play-button')
      await root.verifyGridShowsAtLeast(LAPTOP_FLOOR)
      await root.verifyNothingIsScrolled()

      await fiveClips(root)

      // The whole regression in one assertion: five clips used to leave 16px
      // of grid and a play button the song bar was swallowing.
      await root.verifyNotOccluded('play-button')
      await root.verifyClipPlayFullyInViewport()
      await root.verifyGridShowsAtLeast(LAPTOP_FLOOR)
      await root.verifyNothingIsScrolled()
    })

    test('the capped dock scrolls its lanes without slicing their focus rings', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await fiveClips(root)

      // Ticket 25's 4px padding has to survive the box gaining a second axis.
      await root.verifyFocusRingsFitTheScrollBox('song-lanes')
      await root.verifySongPlayFullyInViewport()
    })
  })

  test.describe('1440x700', () => {
    test.use({ viewport: { width: 1440, height: 700 } })

    test('clip play survives one clip and five here too', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.verifyNotOccluded('play-button')
      await fiveClips(root)
      await root.verifyNotOccluded('play-button')
      await root.verifyClipPlayFullyInViewport()
      await root.verifyGridShowsAtLeast(LAPTOP_FLOOR)
      await root.verifyNothingIsScrolled()
    })
  })

  test.describe('tablet band, 1100x800', () => {
    test.use({ viewport: { width: 1100, height: 800 } })

    test('the tablet band keeps its floor and its play button at five clips', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await fiveClips(root)

      await root.verifyNotOccluded('play-button')
      await root.verifyClipPlayFullyInViewport()
      // The tablet's own numbers: 12 + 8, then two 50px rows with an 8px gap.
      await root.verifyGridShowsAtLeast(12 + 8 + 2 * 50 + 8)
      await root.verifyNothingIsScrolled()
    })
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
    // is what is short here — it still has 162px of content it is not showing,
    // but it is well clear of its floor.
    await root.verifyLaneStripWhole()
    await root.verifyGridWellIsTheScroller()
    await root.verifyGridFloor(3)
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

// Below 500px of viewport height the frame gives up and the whole page scrolls
// (ADR 0030, as amended by ticket 23 — the repo owner's call). It is the one
// band where this app's page-never-scrolls rule inverts, and the reason is that
// no fixed arrangement keeps both play buttons reachable down here: the grid's
// floor plus the song bar's header is taller than the room between the two
// pinned bars, so song play ends up behind the transport from 492px down.
// Scrolling the page reaches both; a fixed frame that hides one reaches
// neither.
for (const height of [460, 492]) {
  test.describe(`small phone, 390x${height} — under the short-window threshold`, () => {
    test.use({ viewport: { width: 390, height } })

    test('the page scrolls, and both play buttons are reachable and uncovered', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      // One clip, then three, then five: the floor has to hold at each, and
      // both buttons have to stay reachable as the song grows.
      for (const clips of [1, 3, 5]) {
        if (clips > 1) {
          await root.startBlank()
          for (let i = 1; i < clips; i += 1) await root.addClip()
          await root.verifyClipCount(clips)
        }

        await root.verifyPageIsTheScroller()

        // Reachable means reachable by scrolling, which is the whole point of
        // the exception — and unoccluded when you get there, by
        // `elementFromPoint` rather than viewport intersection.
        await root.scrollPageToTop()
        await root.verifyNotOccluded('song-play-button')
        await root.verifyGridFloor(3)

        await root.scrollPageToBottom()
        await root.verifyNotOccluded('play-button')
        await root.verifyNotOccluded('song-play-button')
      }
    })
  })
}

// The other side of the boundary. 505 is the first fixed-frame height and the
// first height at which song play is wholly clear of the transport — the two
// have to be the same number or the threshold fails at its own edge, which is
// why this runs at 505 exactly rather than somewhere comfortable.
for (const height of [505, 520]) {
  test.describe(`small phone, 390x${height} — at and above the threshold`, () => {
    test.use({ viewport: { width: 390, height } })

    test('the frame is still fixed, and song play is wholly clear', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      // The page does not scroll here — that is the invariant the band below
      // gives up. The *region* does, which is the floor being paid for and has
      // been allowed since the floor landed.
      await root.verifyPageDoesNotScroll()
      await root.verifyGridWellIsTheScroller()
      await root.verifyGridFloor(3)
      await root.verifyNotOccluded('song-play-button')
      await root.verifyTransportFullyInViewport()
    })
  })
}
