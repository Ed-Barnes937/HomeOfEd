import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

// The small-phone reference viewport from the design handoff.
test.use({ viewport: { width: 390, height: 844 } })

test('the whole 6x16 grid is still there on a phone — the rail is pinned and the steps scroll', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPhoneChromeShown()
  // A fresh browser is seeded with a sample clip (tickets 36/17); this suite is
  // about the layout, so it starts from a known-empty grid — the New boop reset.
  await root.startBlank()

  // Nothing is dropped: the first and last cell of the first and last row all
  // exist, even though only ~7 columns fit on screen at once.
  await root.verifyCellOff('kick', 0)
  await root.verifyCellOff('kick', 15)
  await root.verifyCellOff('boop', 0)
  await root.verifyCellOff('boop', 15)

  await root.verifyLoopMapCoversWholeLoop()
  await root.verifyNoHorizontalOverflow()
})

test('swiping to bars 3-4 snaps to the bar line, and a cell painted there stays painted', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.verifyStepWindowAt(0)
  await root.verifyLoopWindowBracketAt(0)

  // A swipe past the second bar line settles on the third — never half a bar.
  await root.swipeSteps(300)
  await root.verifyStepWindowAt(308) // 8 x 32 + 6 x 5 + 2 x 11, the handoff's frame B
  await root.verifyLoopWindowBracketAt(50)

  await root.toggleCell('hat', 9)
  await root.verifyCellOn('hat', 9)
  await root.verifyLoopTick(9, 'note')
  // The swipe itself painted nothing on the way past.
  await root.verifyCellOff('hat', 4)
  await root.verifyCellOff('hat', 8)
})

test('the loop map tracks the playhead, and playback never yanks the scroll position', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.swipeSteps(300)
  await root.verifyStepWindowAt(308)

  await root.pressPlay()
  await root.verifyPlaying()

  await root.fireStep() // tick 0 → step 0, back on bar 1
  await root.advanceDrawClock(0.1)

  // The playhead is off screen behind the window, so the map carries it and
  // the edge glow says which way to swipe back.
  await root.verifyLoopTick(0, 'playhead')
  await root.verifyPlayheadEdgeGlow('left')
  // ...and the child's scroll position is left exactly where they put it.
  await root.verifyStepWindowAt(308)

  await root.fireStep() // tick 1 → step 1
  await root.advanceDrawClock(0.3)
  await root.verifyLoopTick(1, 'playhead')
  await root.verifyLoopTick(0, 'note') // kick is on there
  await root.verifyStepWindowAt(308)
})

test('a playhead inside the window needs no edge glow', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()
  await root.verifyNoPlayheadEdgeGlow() // stopped

  await root.pressPlay()
  await root.fireStep() // tick 0 → step 0, visible at scroll 0
  await root.advanceDrawClock(0.1)
  await root.verifyLoopTick(0, 'playhead')
  await root.verifyNoPlayheadEdgeGlow()
})

test('drag-paint still works inside the window without fighting the scroll', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragPaint('hat', [0, 1, 2, 3])
  await root.verifyCellOn('hat', 0)
  await root.verifyCellOn('hat', 1)
  await root.verifyCellOn('hat', 2)
  await root.verifyCellOn('hat', 3)
  // Painting is not scrolling: the window did not move.
  await root.verifyStepWindowAt(0)

  await root.dragPaint('hat', [0, 1, 2, 3])
  await root.verifyCellOff('hat', 0)
  await root.verifyCellOff('hat', 3)
})

test('the "⋯" menu holds every action the phone chrome drops, Clear grid last', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPhoneChromeTapTargets()

  await root.openPhoneMenu()
  // New boop joined the list when the transport went (screenspace ticket 03):
  // the menu is where every action the phone chrome drops lives, and `TopBar`
  // leads its own action group with New boop too.
  await root.verifyPhoneMenuItems([
    'New boop',
    'My boops',
    'Share',
    'How boop works',
    'Clear grid',
  ])
})

test('the "⋯" menu opens My boops and the hint sheet, closing itself behind them', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openPhoneMenu()
  await root.openBoopsFromPhoneMenu()
  await root.verifyPhoneMenuClosed()
  await root.verifyBoopsPanelShown()
  // The chrome strip is dimmed under the panel, not floating over it.
  await root.verifyPhoneChromeCoveredByOverlay()
  await root.closeBoops()

  await root.openPhoneMenu()
  await root.openHintsFromPhoneMenu()
  await root.verifyPhoneMenuClosed()
  await root.verifyHintSheetShown()
  await root.verifyPhoneChromeCoveredByOverlay()
})

test("the chrome strip's save icon opens \"My boops\" with the save form ready", async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.pressPhoneSave()

  // Nothing is saved by the tap itself (ticket 32) — and no keyboard opens over
  // the list, because autofocus is desktop only.
  await root.verifyBoopsPanelShown()
  await root.verifyBoopCount(0)
  await root.verifySaveNameFieldNotFocused()

  const name = await root.saveBoop()
  await root.verifyBoopCount(1)
  await root.verifyBoopName(0, name)

  // The card is still the 352px phone card (ticket 30's clamp floor), and the
  // form and the row's three icon buttons all fit inside it.
  const { width } = await root.readBoopsCardSize()
  expect(Math.round(width)).toBe(352)
  await root.verifyBoopsCardHasNoOverflow()
})

test('clearing the grid from the "⋯" menu still goes through the confirm', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.verifyCellOn('kick', 0)

  await root.openClearGridConfirm()
  await root.verifyClearGridConfirmShown()
  await root.keepPlaying()
  await root.openClipEditor()
  await root.verifyCellOn('kick', 0)

  await root.openClearGridConfirm()
  await root.clearIt()
  await root.openClipEditor()
  await root.verifyCellOff('kick', 0)
  await root.verifyLoopTick(0, 'empty')
})
