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
