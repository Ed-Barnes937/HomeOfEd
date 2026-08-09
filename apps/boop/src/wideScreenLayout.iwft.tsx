import { test } from './testing/iwftTest.tsx'

// A large monitor (ticket 29): the fixed-geometry column must not sit pinned
// to the left with all the slack on the right.
test.use({ viewport: { width: 2560, height: 1440 } })

test('the grid well is centred on a very wide screen, not pinned to the left', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyStageColumnCentered()
})

test('the pinned transport is inset to that column, not full-bleed', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  // Ticket 37 reversed ticket 33's full-bleed bar: seen on a screen, the inset
  // bar reads as the transport rather than as a floating toolbar.
  await root.verifyTransportInsetToColumn()
})
