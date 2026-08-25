import { test } from './testing/iwftTest.tsx'

// Ticket 23: the play bar never scrolls away. Screenspace ticket 03 kept the
// promise and moved both halves of it. Clip play is the dock's launcher, at
// every width — pinned, never scrolled, and there whether or not the editor is
// open. Song play is the song bar's header, and the song bar is the scrolling
// region's whole content now, so what gives way when the room runs out is the
// lane grid inside its own box, never the header above it.
//
// Every viewport here is deliberately short, so the stack genuinely does not
// fit and something has to give; on a tall window nothing moves and the suite
// would pass against the old layout too.

test.describe('laptop, short window', () => {
  test.use({ viewport: { width: 1280, height: 600 } })

  test('both play buttons are on screen, with nothing scrolled', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    // The whole complaint in one pair of assertions: both buttons are right
    // there, on the resting home surface.
    await root.verifyClipPlayFullyInViewport()
    await root.verifyNotOccluded('clip-launcher-play')
    await root.verifySongPlayFullyInViewport()
    await root.verifyNotOccluded('song-play-button')
    await root.verifyNothingIsScrolled()
  })

  test('the well scrolls inside the card, not the frame', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    await root.verifyGridWellIsTheScroller()
    // The card bounds the grid, so nothing behind it moved: neither the region
    // nor the page has anything to scroll.
    await root.verifyPageDoesNotScroll()
    // Clip play is reachable from both sides of the card — the well's footer
    // inside it and the launcher outside.
    await root.scrollGridWellToBottom()
    await root.verifyNotOccluded('play-button')
    await root.verifyClipPlayFullyInViewport()
  })

  test('the grid is still 6 x 16, at the laptop cell geometry', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    await root.verifyGridIsSixBySixteen()
    await root.verifyCellGeometry(52, 56)
  })

  test('the playhead column lands on its step, scrolled well or not', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

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
// is the only step that puts the overhang past the last cell. Since the card
// contains that column, this is also where the card's own width is measured.
test.describe('laptop, the whole column', () => {
  test.use({ viewport: { width: 1440, height: 700 } })

  test('the playhead at the last step does not push the well sideways', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()
    await root.verifyCardHoldsTheColumn()
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

// The song bar grows with the song, and it is what the scrolling region holds
// now. These are the states that has to survive: one clip and five, at both
// laptop heights and in the tablet band. `elementFromPoint`, not viewport
// intersection, because "drawn but covered" was the old failure mode.
test.describe('the five-clip cap', () => {
  // What the card leaves the well at these viewports, in laptop numbers: the
  // bar-numeral row (15 + 8) and two 66px rows with their 10px gap. Named for
  // what it is — `Grid.module.scss` has no floor and must not be given one —
  // and pinned so that a change to the card's height is loud.
  const TWO_ROWS_VISIBLE = 15 + 8 + 2 * 66 + 10

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

    test('both play buttons survive one clip and five', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.verifyNotOccluded('clip-launcher-play')
      await root.verifyNotOccluded('song-play-button')
      await root.verifyNothingIsScrolled()

      await fiveClips(root)

      // The whole regression in one assertion: five clips used to leave 16px
      // of grid and a play button the song bar was swallowing.
      await root.verifyNotOccluded('clip-launcher-play')
      await root.verifyNotOccluded('song-play-button')
      await root.verifyClipPlayFullyInViewport()
      await root.verifyNothingIsScrolled()

      // And the grid the card opens on is still a usable grid.
      await root.openClipEditor()
      await root.verifyGridShowsAtLeast(TWO_ROWS_VISIBLE)
    })

    test('the song bar scrolls its lanes without slicing their focus rings', async ({
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

    test('both play buttons survive one clip and five here too', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.verifyNotOccluded('clip-launcher-play')
      await fiveClips(root)
      await root.verifyNotOccluded('clip-launcher-play')
      await root.verifyNotOccluded('song-play-button')
      await root.verifyClipPlayFullyInViewport()
      await root.verifyNothingIsScrolled()

      await root.openClipEditor()
      await root.verifyGridShowsAtLeast(TWO_ROWS_VISIBLE)
    })
  })

  test.describe('tablet band, 1100x800', () => {
    test.use({ viewport: { width: 1100, height: 800 } })

    test('the tablet band keeps both play buttons at five clips', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await fiveClips(root)

      await root.verifyNotOccluded('clip-launcher-play')
      await root.verifyNotOccluded('song-play-button')
      await root.verifyClipPlayFullyInViewport()
      await root.verifyNothingIsScrolled()

      // The tablet's own numbers: 12 + 8, then two 50px rows with an 8px gap.
      await root.openClipEditor()
      await root.verifyGridShowsAtLeast(12 + 8 + 2 * 50 + 8)
    })
  })
})

// The dock cap's own failure mode, found in review: a cap under what the bar
// cannot give up does not shrink it, it spills — the dock is `overflow:
// visible`, so the excess lands in the document and the *page* scrolls. The
// dock holds a fixed-height launcher now rather than the growing song bar, so
// there is nothing left to spill; these heights keep the assertion anyway,
// because it is the page-never-scrolls rule and it is cheap to guard.
test.describe('laptop, short windows — the frame must not become a page', () => {
  for (const [width, height] of [
    [1280, 600],
    [1280, 560],
    [1280, 500],
    [1024, 500],
  ] as const) {
    test.describe(`${width}x${height}`, () => {
      test.use({ viewport: { width, height } })

      test('the page does not scroll, and both play buttons are uncovered', async ({
        mountApp,
      }) => {
        const { root } = await mountApp()
        await root.verifyIsShown()

        await root.verifyPageDoesNotMove()
        await root.verifyNotOccluded('clip-launcher-play')
        await root.verifyNotOccluded('song-play-button')
      })
    })
  }
})

test.describe('tablet band, short window', () => {
  test.use({ viewport: { width: 1100, height: 600 } })

  test('both play buttons are on screen here too', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyClipPlayFullyInViewport()
    await root.verifySongPlayFullyInViewport()
    await root.verifyNothingIsScrolled()
  })

  test('the grid is still 6 x 16, at the tablet cell geometry', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    await root.verifyGridIsSixBySixteen()
    await root.verifyCellGeometry(42, 50)
  })

  test('the playhead column lands on its step at the tablet numbers too', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

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

  test('both play buttons are on screen, with nothing scrolled', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPhoneChromeShown()

    await root.verifySongPlayFullyInViewport()
    await root.verifyNotOccluded('song-play-button')
    await root.verifyLauncherFullyInViewport()
    await root.verifyNotOccluded('clip-launcher-play')
    // The region has nothing left to scroll now the grid is behind a tap: the
    // song bar's `max-height: 100%` clamps it to the region and its lane strip
    // is what gives way.
    await root.verifyNothingIsScrolled()
  })

  test('the lane strip scrolls under a header that stays put', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifySongPlayOutsideTheLaneScroller()
  })

  test('the grid keeps its floor inside the card', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    await root.verifyGridFloor(3)
  })

  // `phoneLanes.iwft.tsx` runs at 390x844; this is the same interaction on a
  // window short enough that something has to give.
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
    await root.openClipEditor()

    await root.verifyGridIsSixBySixteen()
    await root.verifyCellGeometry(32, 44)
  })
})

// The band the 505px page-scroll exception covers (ADR 0030, as amended by
// ticket 23). The exception exists because no fixed arrangement kept both play
// buttons reachable while both surfaces were up. Only one surface is up now, so
// what these heights assert is the promise itself rather than the mechanism:
// both buttons reachable and uncovered, one clip or five. Whether the
// exception still does any work is screenspace ticket 04's question.
for (const height of [460, 492, 504, 505, 520]) {
  test.describe(`small phone, 390x${height}`, () => {
    test.use({ viewport: { width: 390, height } })

    test('both play buttons are reachable and uncovered, at one clip and at five', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      for (const clips of [1, 3, 5]) {
        if (clips > 1) {
          await root.startBlank()
          for (let i = 1; i < clips; i += 1) await root.addClip()
          await root.verifyClipCount(clips)
        }

        await root.verifyNotOccluded('song-play-button')
        await root.verifyNotOccluded('clip-launcher-play')
      }
    })

    test('the grid keeps its three-row floor inside the card', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.openClipEditor()

      await root.verifyGridFloor(3)
    })
  })
}
