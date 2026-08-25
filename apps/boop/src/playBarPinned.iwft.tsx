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

// Screenspace ticket 04's verify list, at the two viewports it names. A short
// window and a short laptop: the two shapes the retired compromises were each
// written for. Every control the width offers, whole and uncovered, with the
// page still — one clip and five, since five is the state that made the dock
// grow and the grid starve.
for (const [width, height] of [
  [390, 460],
  [1280, 600],
] as const) {
  test.describe(`every control is reachable at ${width}x${height}`, () => {
    test.use({ viewport: { width, height } })

    test('at one clip and at five, with the page still', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.verifyEveryControlIsReachable()

      await root.startBlank()
      await root.addClip()
      await root.addClip()
      await root.addClip()
      await root.addClip()
      await root.verifyClipCount(5)

      await root.verifyEveryControlIsReachable()
    })
  })
}

// The five-clip cap: the most a song can hold, and so the most any bar or well
// ever has to survive. Shared by the laptop suites below.
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

// **The >=1024 dock cap is retired** (screenspace ticket 04), and this is the
// block that measured it. The cap existed because the dock held the song bar
// and the song bar grows with the song: five clips at 1280x600 took 476 of
// 600px. The dock holds a fixed-height launcher since screenspace ticket 03,
// so nothing in it grows — measured with the cap gone, the dock is 132px at
// 1280x600 and at 1280x900, one clip or five, against a cap that would have
// allowed 192. It never bound.
//
// What the cap was really guarding is the rule below, so the rule is what these
// heights assert now: a dock that outgrew its cap spilled into the document and
// scrolled the *page*, because the dock is `overflow: visible`. Five clips as
// well as one, since the growth the cap feared only ever appeared at five.
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

        await root.verifyStageIsAFixedFrame()
        await root.verifyNotOccluded('clip-launcher-play')
        await root.verifyNotOccluded('song-play-button')

        await fiveClips(root)

        await root.verifyStageIsAFixedFrame()
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

  // The phone grid's three-row floor is retired (screenspace ticket 04) and
  // this is what stands in its place. 320px is what the card leaves the rows
  // here, measured — seven rows' worth of room for six rows of grid, against
  // the 170px the floor guaranteed. The floor was written when the well and
  // the song bar fought over the frame's one scrolling region; the card bounds
  // the grid now, so there is nothing to fight.
  test('the card leaves the grid more than its old floor ever did', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    await root.verifyGridShowsAtLeast(320)
    await root.verifyClipPlayInWellIsReachable()
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

// **The 505px page-scroll exception is retired** (screenspace ticket 04), and
// this band is where it was measured. It existed because no fixed arrangement
// kept both play buttons reachable while the grid and the song bar were both
// up; only the song bar is up now, so there is nothing left for it to buy.
//
// 504 and 505 were the deciding pair — the last page-scrolling height and the
// first fixed-frame one. That boundary is gone rather than moved, so the pair
// is kept and pointed the other way: every height here asserts the *same*
// promise, and `verifyStageIsAFixedFrame` is what would fail if 504 started
// behaving differently from 505 again. The heights below 505 are the ones that
// used to scroll the document; they are the whole point of running these.
//
// 380 and 420 are new, and they are the heights the retired grid floor failed
// at: with the floor on, clip play sat wholly below the fold at 380 (y 381-429
// against a 380px window) and 13px below it at 420, because screenspace ticket
// 03 put that button inside the well the floor refused to shrink.
for (const height of [380, 420, 460, 492, 504, 505, 520]) {
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
        await root.verifyStageIsAFixedFrame()
      }
    })

    test('the grid fits the card, and clip play under it is reachable', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.openClipEditor()

      // The grid is now a straight function of the window, with no step in it
      // anywhere: the card is `max-height: 88dvh` and everything between the
      // card's edge and the rows — the ×, the clip header, the well's padding,
      // the loop map, the clip control — is a fixed 243px. Measured at 91px of
      // rows at 380, 127 at 420, 162 at 460 and 201 at 505, all within 1px of
      // this. It is a *measurement*, not a layout rule; nothing holds the grid
      // here. What it pins is that the relationship stays linear — the retired
      // floor and the retired 505 exception were both steps in it.
      await root.verifyGridShowsAtLeast(Math.floor(height * 0.88) - 243)
      await root.verifyClipPlayInWellIsReachable()
      await root.verifyStageIsAFixedFrame()
    })
  })
}

// The boundary itself, asserted as absent. 504 and 505 were the pair the
// exception turned on — 126px of page overflow on one side and zero on the
// other. One viewport, resized across the old threshold: the grid must not
// step, because nothing keys off 505 any more.
test.describe('small phone, across the retired 505 threshold', () => {
  test.use({ viewport: { width: 390, height: 505 } })

  test('504 and 505 differ by a pixel of window, not by a layout mode', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()
    await root.verifyStageIsAFixedFrame()

    await root.verifyResizingDoesNotStepTheGrid(390, 504)

    await root.verifyStageIsAFixedFrame()
    await root.verifyClipPlayInWellIsReachable()
  })
})
