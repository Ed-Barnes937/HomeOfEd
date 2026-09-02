import { test } from './testing/iwftTest.tsx'

// A large monitor (ticket 29): the fixed-geometry column must not sit pinned
// to the left with all the slack on the right.
test.use({ viewport: { width: 2560, height: 1440 } })

test('the home surface is centred on a very wide screen, not pinned to the left', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyStageColumnCentered()
})

test('the pinned dock is inset to that column, not full-bleed', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  // Ticket 37 reversed ticket 33's full-bleed bar: seen on a screen, the inset
  // bar reads as part of the app rather than as a floating toolbar. The dock
  // holds the clip launcher since screenspace ticket 03; the rule is the
  // dock's, not that particular bar's.
  await root.verifyLauncherInsetToColumn()
})

test('the card the grid opens in is centred on the column too', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openClipEditor()

  // The card *contains* the fixed-geometry column, so on a 2560px screen it
  // must be the column's width plus its own padding — not the viewport's.
  await root.verifyCardHoldsTheColumn()
  await root.verifyGridWellHasNoSidewaysScroll()
})
