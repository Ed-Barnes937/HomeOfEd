import { test } from './testing/iwftTest.tsx'

test('the playhead advances during playback, driven by the draw-time channel', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  // Nothing has sounded yet, so there is nothing to point at — the one case that
  // still has no playhead at all (boop-playhead ticket 04).
  await root.verifyPlayheadHidden()

  await root.pressPlay()
  await root.verifyPlaying()

  await root.fireStep() // tick 0 → step 0
  await root.advanceDrawClock(0.1)
  await root.verifyPlayheadAtStep(0)
  await root.verifyActiveBar(0)

  await root.fireStep() // tick 1 → step 1
  await root.advanceDrawClock(0.3) // generous margin over the ~0.2 audioTime — repeated 0.1 lookaheads drift in floating point
  await root.verifyPlayheadAtStep(1)

  await root.fireStep() // tick 2 → step 2
  await root.advanceDrawClock(0.45)
  await root.fireStep() // tick 3 → step 3
  await root.advanceDrawClock(0.6)
  await root.fireStep() // tick 4 → step 4, crosses into bar 2
  await root.advanceDrawClock(0.75)
  await root.verifyPlayheadAtStep(4)
  await root.verifyActiveBar(1)
})

test('a struck cell squashes and its row label bobs — never a strobe or flash', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  // A fresh browser is seeded with a sample clip (tickets 36/17) whose kick
  // already sits on step 0; start from Blank so this test owns the one hit it fires.
  await root.startBlank()

  await root.toggleCell('kick', 0)
  await root.pressPlay()
  await root.verifyPlaying()

  await root.fireStep() // tick 0 → step 0, kick is on
  await root.advanceDrawClock(0.1)

  await root.verifyCellStruck('kick', 0)
  await root.verifyRowLabelStruck('kick')
})

test('the playhead stays in sync after a tempo change mid-playback', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.pressPlay()
  await root.verifyPlaying()

  await root.fireStep() // tick 0 → step 0
  await root.advanceDrawClock(0.1)
  await root.verifyPlayheadAtStep(0)

  await root.setTempoPercent(80) // tempo change while the playhead is mid-loop
  await root.verifyTempo(157)

  await root.fireStep() // tick 1 → step 1 — still driven by the same draw-time channel
  await root.advanceDrawClock(0.3) // generous margin — repeated 0.1 lookaheads drift in floating point
  await root.verifyPlayheadAtStep(1)

  await root.fireStep() // tick 2 → step 2
  await root.advanceDrawClock(0.45)
  await root.verifyPlayheadAtStep(2)
})

test('play always starts at step 1 of bar 1, wherever in the loop it was stopped', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.pressPlay()
  await root.verifyPlaying()
  await root.crankSteps(8) // stopped mid-loop, on step 8 of 16
  await root.verifyPlayheadAtStep(7)

  await root.pressPlay() // stop
  await root.verifyPaused()
  // Ticket 04: the marker stays on the step it stopped on, dimmed — but where
  // the *transport* resumes from is a separate question, answered below.
  await root.verifyPlayheadStoppedAtStep(7)

  await root.pressPlay() // and away again — from the top, not from step 8
  await root.verifyPlaying()
  await root.verifyPlayheadHidden() // nothing stale from the last run
  await root.crankSteps(1)
  await root.verifyPlayheadAtStep(0)
  await root.verifyActiveBar(0)
})

test('the spacebar starts from the top too — one rule, however you press play', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.pressSpaceKey()
  await root.verifyPlaying()
  await root.crankSteps(8)
  await root.verifyPlayheadAtStep(7)

  await root.pressSpaceKey()
  await root.verifyPaused()
  await root.verifyPlayheadStoppedAtStep(7)

  await root.pressSpaceKey()
  await root.verifyPlaying()
  await root.crankSteps(1)
  await root.verifyPlayheadAtStep(0)
})

test('the playhead stays where it stopped, and resuming does not reset the pattern', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.toggleCell('snare', 3)
  await root.pressPlay()
  await root.verifyPlaying()

  await root.fireStep() // tick 0 → step 0
  await root.advanceDrawClock(0.1)
  await root.verifyPlayheadAtStep(0)

  await root.pressPlay() // pause
  await root.verifyPaused()
  // Since boop-playhead ticket 04 a pause leaves the playhead on the step it
  // paused on, dimmed, instead of unmounting it — where we are is a fact about
  // the boop (spec §1). It is the *clip's* step, so a paused clip loop keeps it.
  await root.verifyPlayheadStoppedAtStep(0)
  await root.verifyCellOn('snare', 3)

  await root.pressPlay() // resume
  await root.verifyPlaying()
  await root.verifyCellOn('snare', 3)
})
