import { SAVE_KEY } from './persistence/storage.ts'
import { test } from './testing/iwftTest.tsx'

// The instrument picker (boop-instruments ticket 05, spec §4/§5/§10.1): every
// row's rail artwork is a button that opens a paper-card dialog of the whole
// roster, sectioned Drums / Notes / Silly. Tapping a sound auditions it and
// swaps the row live, and the dialog stays open so a child browses by ear.
//
// Runs at the default 1280px CT viewport except where a describe says
// otherwise; the phone pass is at the bottom.

test('the rail artwork opens the picker: the whole roster in three labelled groups', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.verifyRowInstrumentButtonLabel('kick', "Kick. Change this row's sound.")
  await root.openRowInstrumentPicker('kick')

  await root.verifyInstrumentPickerLabelled('Change this sound')
  await root.verifyInstrumentSections(['Drums', 'Notes', 'Silly'])
  await root.verifyInstrumentSectionEntries('drums', [
    'Kick',
    'Snare',
    'Hi-hat',
    'Tom',
    'Clap',
    'Shaker',
    'Cowbell',
    'Woodblock',
    'Triangle',
    'Cymbal',
  ])
  await root.verifyInstrumentSectionEntries('notes', [
    'Marimba',
    'Boop',
    'Bass',
    'Bell',
    'Chime',
    'Pluck',
  ])
  await root.verifyInstrumentSectionEntries('silly', ['Boing', 'Pop', 'Zap', 'Drip'])
  // 20 sounds do not fit a dialog on a laptop, let alone a phone: the list
  // scrolls inside the card, so the last one is still reachable.
  await root.verifyInstrumentPickerScrolls('drip')
})

test('tapping a sound auditions it and swaps the row live, keeping the painted steps', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  // The same rhythm, a new sound (spec §4): paint the kick, then swap it.
  await root.dragPaint('kick', [0, 1, 2, 3])
  await root.verifyCellOn('kick', 0)

  await root.openRowInstrumentPicker('kick')
  await root.chooseInstrument('cowbell')

  await root.verifyGridRows(['cowbell', 'snare', 'hat', 'tom', 'marimba', 'boop'])
  await root.verifyCellOn('cowbell', 0)
  await root.verifyCellOn('cowbell', 3)
  await root.verifyCellOff('cowbell', 4)
  // Browsing by ear: the dialog is still open, and tapping through several
  // sounds leaves the last one on the row.
  await root.verifyInstrumentPickerShown()
  await root.chooseInstrument('zap')
  await root.verifyGridRows(['zap', 'snare', 'hat', 'tom', 'marimba', 'boop'])
  await root.verifyCellOn('zap', 0)

  await root.closeInstrumentPicker()
  await root.verifyGridRows(['zap', 'snare', 'hat', 'tom', 'marimba', 'boop'])
})

test('the tap itself makes the sound, whether or not the swap is applied', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  // Unlock audio with a play/pause round trip, the way grid.iwft's audition
  // test does — this test is about the picker's tap, not the unlock race.
  await root.pressPlay()
  await root.verifyPlaying()
  await root.pressPlay()
  await root.verifyPaused()
  await root.startBlank()

  await root.openRowInstrumentPicker('kick')
  await root.chooseInstrument('bell')

  await root.verifyPlayed([{ instrumentId: 'bell', audioTime: undefined }])
})

test("the sounds this clip already has are disabled, the row's own included", async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openRowInstrumentPicker('hat')

  // The default six are all in this clip, so all six read as such — including
  // the row's own hi-hat, which makes a re-tap of it audition and nothing else.
  await root.verifyInstrumentEntryDisabled('hat', 'Hi-hat')
  await root.verifyInstrumentEntryDisabled('kick', 'Kick')
  await root.verifyInstrumentEntryDisabled('boop', 'Boop')
  await root.verifyInstrumentEntryEnabled('cowbell')

  // A swap frees the sound it left and claims the one it took.
  await root.chooseInstrument('cowbell')
  await root.verifyInstrumentEntryDisabled('cowbell', 'Cowbell')
  await root.verifyInstrumentEntryEnabled('hat')
})

test('"Remove this row" removes the row and closes the picker, with no confirm', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openRowInstrumentPicker('snare')
  await root.verifyRemoveRowOffered()
  await root.removeThisRow()

  await root.verifyGridRows(['kick', 'hat', 'tom', 'marimba', 'boop'])
  await root.verifyCellOff('kick', 0)
})

test('at one row there is nothing to remove, so the footer is not offered', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  // Seeded: the app cannot get to a one-row clip until "+ Add a sound" and
  // repeated removals exist (ticket 06). Seeded after the reload, because the
  // outgoing page flushes its autosave on the way out.
  await page.reload()
  await page.evaluate(({ key, doc }) => window.localStorage.setItem(key, JSON.stringify(doc)), {
    key: SAVE_KEY,
    doc: {
      version: 1,
      working: {
        name: '',
        kitId: 'launch',
        tempo: 100,
        patterns: [{ rows: [{ instrumentId: 'cowbell', steps: '1000000000000000' }] }],
      },
      creations: [],
    },
  })

  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()
  await root.verifyGridRows(['cowbell'])

  await root.openRowInstrumentPicker('cowbell')
  await root.verifyRemoveRowAbsent()
  // The rest of the picker still works: the one row can still change its sound.
  await root.chooseInstrument('chime')
  await root.verifyGridRows(['chime'])
})

test('the picker dismisses like every other dialog: the ×, the backdrop, and Escape', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  await root.openRowInstrumentPicker('kick')
  await root.closeInstrumentPicker()

  await root.openRowInstrumentPicker('kick')
  await root.dismissInstrumentPickerByOutsideTap()

  await root.openRowInstrumentPicker('kick')
  await root.dismissInstrumentPickerByEscape()
  // Escape closed the picker and nothing else: the clip editor card the picker
  // opened over is still there, so a child is not thrown back to the song bar.
  await root.verifyClipEditorOpen()
})

/**
 * Spec §5, verbatim: a child who picks instruments on clip 1 without painting
 * anything, visits clip 2, and comes back sees exactly their rows — and so does
 * the child who closes the tab and comes back tomorrow. The selection is the
 * clip's pattern, so it rides the autosave with no new field.
 */
test('instrument choices survive a clip switch and a reload, with nothing painted', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.startBlank()

  // Clip 1, nothing painted: swap two of the six rows.
  await root.openRowInstrumentPicker('kick')
  await root.chooseInstrument('cowbell')
  await root.closeInstrumentPicker()
  await root.openRowInstrumentPicker('hat')
  await root.chooseInstrument('chime')
  await root.closeInstrumentPicker()
  const chosen = ['cowbell', 'snare', 'chime', 'tom', 'marimba', 'boop']
  await root.verifyGridRows(chosen)

  // Visit clip 2 — its own rows are the default six.
  await root.closeClipEditor()
  await root.openNewClipPicker()
  await root.pickClip('blank')
  await root.openClipEditor()
  await root.verifyGridRows(['kick', 'snare', 'hat', 'tom', 'marimba', 'boop'])

  // Come back to clip 1: the chosen rows are still there.
  await root.closeClipEditor()
  await root.openClipEditorFromChip(0)
  await root.verifyGridRows(chosen)

  // And they are still there after a reload, out of the autosave.
  await page.reload()
  const { root: reloaded } = await mountApp()
  await reloaded.verifyIsShown()
  await reloaded.verifyClipCount(2)
  await reloaded.openClipEditorFromChip(0)
  await reloaded.verifyGridRows(chosen)
})

test.describe('the phone, where the rail is pinned', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the pinned rail buttons open the picker, and a swap keeps the beats', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyPhoneChromeShown()
    await root.startBlank()

    await root.verifyRowInstrumentButtonLabel('tom', "Tom. Change this row's sound.")
    await root.toggleCell('tom', 2)
    await root.openRowInstrumentPicker('tom')
    await root.verifyInstrumentSections(['Drums', 'Notes', 'Silly'])
    await root.verifyInstrumentPickerScrolls('drip')

    await root.chooseInstrument('boing')
    await root.verifyGridRows(['kick', 'snare', 'hat', 'boing', 'marimba', 'boop'])
    await root.verifyCellOn('boing', 2)
    await root.verifyInstrumentPickerShown()
    await root.closeInstrumentPicker()
    await root.verifyNoHorizontalOverflow()
  })

  test('paint-vs-scroll inside the step window is untouched by the rail buttons', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.startBlank()

    // The same swipe-then-paint the phone layout suite pins: a sideways swipe
    // snaps to the bar line and paints nothing on the way past.
    await root.verifyStepWindowAt(0)
    await root.swipeSteps(300)
    await root.verifyStepWindowAt(308)
    await root.toggleCell('hat', 9)
    await root.verifyCellOn('hat', 9)
    await root.verifyCellOff('hat', 8)
    await root.verifyInstrumentPickerClosed()
  })
})
