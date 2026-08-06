import { test } from './testing/iwftTest.tsx'

test('renders the 6x16 grid, empty', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyCellOff('kick', 0)
  await root.verifyCellOff('boop', 15)
})

test('tapping a cell toggles it on, tapping again toggles it off', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('snare', 4)
  await root.verifyCellOn('snare', 4)

  await root.toggleCell('snare', 4)
  await root.verifyCellOff('snare', 4)
})

test('pressing play satisfies the gesture-gated audio start and loops what is on the grid', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPaused()

  await root.pressPlay()
  await root.verifyPlaying()

  await root.toggleCell('kick', 0)
  await root.fireStep() // tick 0 → step 0, kick is on
  await root.verifyPlayed([{ instrumentId: 'kick', audioTime: 0.1 }])
})

test('edits made while playing are heard on the next pass, not the current one', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.pressPlay()
  await root.verifyPlaying()

  await root.fireStep() // tick 0 → step 0, grid still empty
  await root.toggleCell('boop', 1)
  await root.fireStep() // tick 1 → step 1, boop now on

  await root.verifyPlayed([{ instrumentId: 'boop', audioTime: 0.1 }])
})

test('toggling a cell on while stopped plays its sample immediately (audition)', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Unlock audio via a play/pause round trip first (a real first tap would
  // unlock asynchronously — see the engine's own audition tests), so this
  // test isolates the UI-path assertion rather than the unlock race.
  await root.pressPlay()
  await root.verifyPlaying()
  await root.pressPlay()
  await root.verifyPaused()

  await root.toggleCell('marimba', 7)
  await root.verifyCellOn('marimba', 7)
  await root.verifyPlayed([{ instrumentId: 'marimba', audioTime: undefined }])
})

test('dragging across cells paints them on, latched from the first cell', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragPaint('hat', [0, 1, 2, 3])
  await root.verifyCellOn('hat', 0)
  await root.verifyCellOn('hat', 1)
  await root.verifyCellOn('hat', 2)
  await root.verifyCellOn('hat', 3)
})

test('dragging across already-on cells paints them off, latched from the first cell', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.dragPaint('tom', [0, 1, 2])
  await root.verifyCellOn('tom', 0)
  await root.verifyCellOn('tom', 1)
  await root.verifyCellOn('tom', 2)

  // Second drag starts on an already-on cell, so it latches "remove" and
  // clears the whole run — even the untouched middle cell.
  await root.dragPaint('tom', [0, 1, 2])
  await root.verifyCellOff('tom', 0)
  await root.verifyCellOff('tom', 1)
  await root.verifyCellOff('tom', 2)
})

test('clear-all is reachable by touch, behind a confirm, and never fires without it', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('kick', 0)
  await root.toggleCell('snare', 5)
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOn('snare', 5)

  await root.openClearGridConfirm()
  await root.verifyClearGridConfirmShown()
  await root.keepPlaying()
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOn('snare', 5)

  await root.openClearGridConfirm()
  await root.verifyClearGridConfirmShown()
  await root.clearIt()
  await root.verifyCellOff('kick', 0)
  await root.verifyCellOff('snare', 5)
})

test('the tempo slider starts at the default 100 BPM and changes the loop speed live', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyTempo(100)

  await root.pressPlay()
  await root.verifyPlaying()

  await root.setTempoPercent(100)
  await root.verifyTempo(200)

  await root.setTempoPercent(0)
  await root.verifyTempo(60)
})
