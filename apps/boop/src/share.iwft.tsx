import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

// Reading back what the button copied is the point of the test; Chromium needs
// the permission granted for `navigator.clipboard.readText()`.
test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('sharing copies a link, and opening that link loads the groove ready to play', async ({
  mountApp,
}) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  await first.root.toggleCell('kick', 0)
  await first.root.toggleCell('snare', 4)
  await first.root.setTempoPercent(50)
  await first.root.verifyTempo(110)

  await first.root.pressShare()
  await first.root.verifyShareCopied()
  const link = await first.root.readCopiedShareLink()
  expect(link).toContain('#g=')

  await first.root.openShareLink(link)
  // A different visitor's browser: no autosave of their own, just the link, so
  // what comes back can only have come out of the fragment. Cleared after the
  // reload — the outgoing page flushes its pending autosave as it leaves.
  await first.root.clearSavedState()
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyCellOn('kick', 0)
  await root.verifyCellOn('snare', 4)
  await root.verifyCellOff('boop', 15)
  await root.verifyTempo(110)

  await root.pressPlay()
  await root.verifyPlaying()
  await root.fireStep() // tick 0 → step 0, the shared kick is on
  await root.verifyPlayed([{ instrumentId: 'kick', audioTime: 0.1 }])
})

test('the "Copied!" flip reverts on its own, leaving no modal or link field behind', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()

  await root.pressShare()
  await root.verifyShareCopied()
  await root.verifyShareResting()

  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a mangled link opens an empty grid rather than an error', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.verifyIsShown()

  // Truncated mid-token rather than obvious junk: a real link, mangled the way
  // a chat app wrapping a long URL would mangle it.
  await first.root.toggleCell('kick', 0)
  await first.root.pressShare()
  await first.root.verifyShareCopied()
  const link = await first.root.readCopiedShareLink()

  await first.root.openShareLink(link.slice(0, link.length - 12))
  await first.root.clearSavedState()
  const { root } = await mountApp()

  await root.verifyIsShown()
  await root.verifyCellOff('kick', 0)
  await root.verifyCellOff('boop', 15)
  await root.verifyTempo(100)
})
