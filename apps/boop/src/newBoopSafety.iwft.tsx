import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

/**
 * "New boop" must not silently take a child's clips away (boop-clips ticket
 * 03). It is the only action besides the clip header's own delete that destroys
 * a clip (ADR 0056 §2), so it asks first - as a two-button kid card, and only
 * when the reset would really lose something.
 *
 * A fresh browser is seeded with a sample clip (tickets 36/17), which is never
 * a row in "My boops": the seed is therefore exactly the boop with something to
 * lose, and most of these suites start from it.
 */

test('New boop asks first when the boop is not in "My boops"', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.pressNewBoopAction()

  await root.verifyKeepBoopCardShown()
  // Two labelled choices, no prose and no browser confirm (ADR 0031 §2).
  await root.verifyKeepBoopCardChoices('Save it', 'Start fresh')
})

test('"Start fresh" resets exactly as New boop always did', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.toggleCell('snare', 4)

  await root.pressNewBoopAction()
  await root.startFresh()

  await root.verifyClipCount(1)
  await root.verifySongLength('0 bars')
  await root.verifySavedState('Not saved yet')
  await root.openClipEditor()
  await root.verifyCellOff('kick', 0)
  await root.verifyCellOff('snare', 4)
})

test('"Save it" saves the boop under an automatic name, then resets', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.toggleCell('snare', 6)

  await root.pressNewBoopAction()
  await root.saveIt()

  // One tap, no typing: the same automatic name the panel's save form offers,
  // over the boop that was on screen rather than a blank one.
  const saved = await root.readSavedBoops()
  expect(saved.map((boop) => boop.name)).toEqual(['Boop 1'])
  const snare = saved[0]?.patterns[0]?.rows.find((row) => row.instrumentId === 'snare')
  expect(snare?.steps[6]).toBe('1')

  await root.openBoops()
  await root.verifyBoopCount(1)
  await root.verifyBoopName(0, 'Boop 1')
  await root.closeBoops()

  // And then the reset it was asked for, with the boop it kept behind it.
  await root.verifySavedState('Not saved yet')
  await root.openClipEditor()
  await root.verifyCellOff('kick', 0)
})

test('a boop that is still its row in "My boops" needs no card; one edit brings it back', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openBoops()
  await root.saveBoop()
  await root.closeBoops()
  await root.verifySavedState('Boop 1')

  // Nothing to lose - it is one tap away in the list, so the reset just runs.
  await root.pressNewBoopAction()
  await root.verifyNoKeepBoopCard()
  await root.verifySavedState('Not saved yet')

  await root.openBoops()
  await root.loadBoop(0)
  await root.toggleCell('snare', 4)

  await root.pressNewBoopAction()
  await root.verifyKeepBoopCardShown()
  await root.startFresh()
})

test('a blank boop holds nothing, so a second New boop resets straight away', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.pressNewBoop()

  // The card would be asking about the empty screen the last one just made.
  await root.pressNewBoopAction()
  await root.verifyNoKeepBoopCard()
  await root.verifyClipCount(1)
})

test('picking sounds counts, even with no step painted yet', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.pressNewBoop()

  // Nothing is painted, but the rows are no longer the kit's default six
  // (ADR 0042) - choosing what a boop is made of is making something.
  await root.openRowInstrumentPicker('kick')
  await root.chooseInstrument('cowbell')
  await root.closeInstrumentPicker()

  await root.pressNewBoopAction()
  await root.verifyKeepBoopCardShown()
  await root.startFresh()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the card follows New boop out of the "⋯" menu', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPhoneChromeShown()

    await root.pressNewBoopAction()

    await root.verifyPhoneMenuClosed()
    await root.verifyKeepBoopCardShown()

    await root.saveIt()
    expect((await root.readSavedBoops()).map((boop) => boop.name)).toEqual(['Boop 1'])
  })
})
