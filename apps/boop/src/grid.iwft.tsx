import { expect } from '@playwright/experimental-ct-react'

import { SAVE_KEY } from './persistence/storage.ts'
import { test } from './testing/iwftTest.tsx'

// A fresh browser is seeded with a sample clip (tickets 36/17), so every test
// here that cares about the grid it starts from says so with the one-tap New
// boop reset — the same tap a child would use.
test('renders the 6x16 grid, empty', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.verifyCellOff('kick', 0)
  await root.verifyCellOff('boop', 15)
})

test('tapping a cell toggles it on, tapping again toggles it off', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

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
  await root.startBlank()
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
  await root.startBlank()

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

test('the keyboard can still toggle a cell straight after a drag-paint', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // A drag that ends on a different cell fires no cell `click` at all — the
  // suppression that stops a drag undoing its own first cell must not survive
  // into the next Enter press.
  await root.dragPaint('tom', [0, 1, 2])
  await root.verifyCellOn('tom', 2)

  await root.toggleCellWithKeyboard('tom', 8)
  await root.verifyCellOn('tom', 8)
})

test('clear-all is reachable by touch, behind a confirm, and never fires without it', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

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

test('the grid and tempo are autosaved, and a reload brings them back', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()
  await first.root.startBlank()

  await first.root.toggleCell('snare', 4)
  await first.root.toggleCell('kick', 0)
  await first.root.setTempoPercent(50)
  await first.root.verifyTempo(110)
  await first.root.waitForAutosavedCell('snare', 4)

  await page.reload()
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyTempo(110)
  await root.openClipEditor()
  await root.verifyCellOn('snare', 4)
  await root.verifyCellOn('kick', 0)
  await root.verifyCellOff('boop', 15)
})

test('a multi-clip working song survives a reload, landing on the clip being edited', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  // A two-clip song with placements, edited on clip 2 (ticket 14). Written
  // straight into the slot: no UI makes clips yet — that is the point of the
  // expand step.
  const working = {
    name: '',
    kitId: 'launch',
    tempo: 120,
    patterns: [
      { rows: [{ instrumentId: 'kick', steps: '1000000000000000' }], name: 'Clip 1', tint: 0 },
      { rows: [{ instrumentId: 'snare', steps: '0010000000000000' }], name: 'Drums', tint: 3 },
    ],
    placements: '112.............',
    gridClip: 1,
  }
  // Seeded *after* the reload: the outgoing page flushes its pending autosave
  // on the way out, so seeding first would only be overwritten.
  await page.reload()
  await page.evaluate(
    ({ key, doc }) => window.localStorage.setItem(key, JSON.stringify(doc)),
    { key: SAVE_KEY, doc: { version: 1, working, creations: [] } },
  )

  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyTempo(120)
  // The grid shows the clip the child was editing — clip 2, not clip 1.
  await root.openClipEditor()
  await root.verifyCellOn('snare', 2)
  await root.verifyCellOff('kick', 0)

  // An edit autosaves the *whole* song back: both clips, names, tints,
  // placements and the active clip all still there.
  await root.toggleCell('snare', 4)
  await root.waitForAutosavedCell('snare', 4, 1)

  const saved = await root.readAutosavedGrid()
  expect(saved?.patterns.map((p) => ({ name: p.name, tint: p.tint }))).toEqual([
    { name: 'Clip 1', tint: 0 },
    { name: 'Drums', tint: 3 },
  ])
  expect(saved?.patterns[0]?.rows.find((r) => r.instrumentId === 'kick')?.steps).toBe(
    '1000000000000000',
  )
  expect(saved?.placements).toBe('112.............')
  expect(saved?.gridClip).toBe(1)
})

test('the tempo slider starts at the default 100 BPM and changes the loop speed live', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()
  await root.verifyTempo(100)

  await root.pressPlay()
  await root.verifyPlaying()

  await root.setTempoPercent(100)
  await root.verifyTempo(200)

  await root.setTempoPercent(0)
  await root.verifyTempo(60)
})
