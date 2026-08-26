import { test } from './testing/iwftTest.tsx'

// The song bar is the home surface and the grid opens as a card (screenspace
// ticket 03, spec — the `clip-dialog` variant). The song is already the less
// discoverable half of the app, so it is the half that stays on the frame; the
// grid is the focused thing a child chooses to open.
//
// Three widths, one promise, because the arrangement is the same at all of
// them: phone (<1024), the tablet band (1024–1279) and the laptop (≥1280).
const WIDTHS = [
  { name: 'phone', viewport: { width: 390, height: 844 } },
  { name: 'tablet', viewport: { width: 1100, height: 800 } },
  { name: 'laptop', viewport: { width: 1440, height: 900 } },
] as const

for (const { name, viewport } of WIDTHS) {
  test.describe(`${name}, ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })

    test('the song bar is what a child lands on, with the grid behind a tap', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.verifySongBarIsTheHomeSurface()
      // The first-visit seed's clip, named on the launcher that opens it.
      await root.verifyLauncherClip('Boom clap')
    })

    test('the dock is one launcher row and nothing else — no second pinned bar', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.verifyLauncherIsTheWholeDock()
      // Song play is the song bar's, at every width. Repeating it on the
      // launcher is the duplicate this ticket exists to remove.
      await root.verifySongPlayIsTheSongHeader()
    })

    test('both play buttons are reachable without scrolling anything', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.verifySongPlayFullyInViewport()
      await root.verifyNotOccluded('song-play-button')
      await root.verifyClipPlayFullyInViewport()
      await root.verifyNotOccluded('clip-launcher-play')
      await root.verifyNothingIsScrolled()
    })

    test('the launcher opens the editor, and the × closes it again', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.verifyClipEditorClosed()

      await root.openClipEditor()
      await root.verifyClipEditorOpen()
      await root.verifyClipEditorLabelled('Boom clap')

      await root.closeClipEditor()
      await root.verifyClipEditorClosed()
    })

    test('a clip chip is the second route in, and opens the editor on that clip', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.startBlank()
      await root.renameActiveClip('Thumper')
      // "+ New clip" is on the song bar, which is behind the card — a child
      // closes the editor to get back to the arrangement.
      await root.closeClipEditor()
      await root.addClip()
      await root.verifyClipCount(2)

      await root.openClipEditorFromChip(0)
      await root.verifyClipChipActive(0)
      await root.verifyActiveClipName('Thumper')
      await root.verifyClipEditorLabelled('Thumper')
    })

    test('a tap on the dimmed backdrop dismisses the card, as the other dialogs do', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.openClipEditor()
      await root.dismissClipEditorByOutsideTap()
      await root.verifyClipEditorClosed()
    })

    test('Escape dismisses the card, the way it dismisses the hint sheet', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.openClipEditor()
      await root.dismissClipEditorByEscape()
      await root.verifyClipEditorClosed()
    })

    // Escape is free inside the card: the grid owns the arrows, Enter and
    // Backspace, and both scrub strips own Left, Right and Home. None of them
    // claims Escape, so closing on it takes nothing away from the grid.
    test('Escape closes the card even from a focused grid cell', async ({ mountApp }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.openClipEditor()
      await root.focusCell('kick', 0)
      await root.dismissClipEditorByEscape()
      await root.verifyClipEditorClosed()
      await root.verifySongBarIsTheHomeSurface()
    })

    test('the grid inside the card is still 6 x 16, and the card holds the whole column', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.startBlank()

      await root.verifyGridIsSixBySixteen()
      // The phone's step window scrolls sideways by design (ADR 0027), so the
      // card-holds-the-column measurement is the laptop renderer's question.
      if (name !== 'phone') await root.verifyCardHoldsTheColumn()

      await root.toggleCell('kick', 0)
      await root.toggleCell('boop', 15)
      await root.verifyCellOn('kick', 0)
      await root.verifyCellOn('boop', 15)
    })

    test('the saved-state chrome is on screen on the home surface (ADR 0031)', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()

      await root.verifyTopBarFullyInViewport()
      if (name === 'phone') await root.verifyPhoneSavedDot(true)
      else await root.verifySavedState('Not saved yet')
    })

    test('the launcher plays the clip, and the editor need not be open for it', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.verifyPaused()

      await root.pressPlay()
      await root.verifyPlaying()
      await root.verifyClipEditorClosed()

      await root.pressPlay()
      await root.verifyPaused()
    })
  })
}

test.describe('the phone, where the transport used to be', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('New boop moved into the "⋯" menu, and still resets in one tap', async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.openPhoneMenu()
    await root.verifyPhoneMenuItems(['New boop', 'My boops', 'Share', 'How boop works', 'Clear grid'])
    await root.pressNewBoop()
    await root.verifyPhoneMenuClosed()
    await root.verifyNoDialogOpen()

    await root.openClipEditor()
    await root.verifyCellOff('kick', 0)
  })
})

test.describe('the laptop, where the clip header used to carry the readout', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // 1024 is where the header is fullest: Speed keeps its 280px slider, so the
  // readout is the only thing with room to give, and it must give space rather
  // than letters.
  test.describe('1024 — the tablet band’s narrow end', () => {
    test.use({ viewport: { width: 1024, height: 800 } })

    test('the readout is whole beside Speed, at the longest string it can hold', async ({
      mountApp,
    }) => {
      const { root } = await mountApp()
      await root.verifyIsShown()
      await root.startBlank()
      await root.closeClipEditor()
      // Position 16 is the longest readout there is.
      await root.toggleLaneSquare(0, 15)
      await root.tapSongStrip(15, 3)

      await root.verifyPlayheadReadout('Position 16 · bar 4 of 4')
      await root.verifyPlayheadReadoutNotTruncated()
      // And with room left over, so a font this repo does not control cannot
      // cut it. 11px fit here exactly and still failed CI — see the helper.
      // 10px is roughly one character of the readout's own font: enough to say
      // the fit is not exact, low enough to hold on CI's wider fallback, which
      // measures 17px of slack against this machine's 29px.
      await root.verifyPlayheadReadoutHasRoomToSpare(10)
      // And it did not push the header wide enough to start a sideways scroll.
      await root.verifyNoSidewaysScroller()
      await root.verifyTempo(100)
    })
  })

  test('the playhead readout is in the song bar header, on screen with the card open', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.startBlank()
    await root.closeClipEditor()
    await root.toggleLaneSquare(0, 0)

    await root.verifyPlayheadReadout('Position 1 · bar 1 of 4')
    await root.tapSongStrip(0, 2)
    await root.verifyPlayheadReadout('Position 1 · bar 3 of 4')

    // The clip header went into the card; the readout did not go with it. It
    // is still rendered on the song bar's header with the card open, dimmed
    // behind the backdrop like everything else the card covers — which is what
    // makes it survive the card being closed again.
    await root.openClipEditor()
    await root.verifyPlayheadReadout('Position 1 · bar 3 of 4')
    await root.closeClipEditor()
    await root.verifyPlayheadReadout('Position 1 · bar 3 of 4')
    await root.verifyNotOccluded('playhead-readout')
  })

  test('clip play is in the well too, and it is the same action as the launcher', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    // Started inside the card, stopped from the dock's launcher once the card
    // is out of the way: one action, two routes, and they agree about state.
    await root.pressWellClipPlay()
    await root.verifyPlaying()
    await root.closeClipEditor()
    await root.verifyPlaying()
    await root.pressPlay()
    await root.verifyPaused()
  })
})

test.describe('the phone, inside the card', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  // The card's backdrop covers the dock, so a phone with clip play only on the
  // launcher would have no way to hear the clip being edited. The well footer
  // is what answers that at this width too (screenspace ticket 03).
  test('clip play rides under the grid in the card, and Clear grid does not', async ({
    mountApp,
  }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openClipEditor()

    await root.verifyNotOccluded('play-button')
    await root.pressWellClipPlay()
    await root.verifyPlaying()

    // Clear grid stays the "⋯" menu's, so the well footer must not grow a
    // second one.
    await root.verifyNoClearGridInTheWell()
  })
})
