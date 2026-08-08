import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('the demoted "Save the sound as a file" link sits below Share and downloads a WAV, no modal', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()
  await root.toggleCell('kick', 0)

  await root.verifyExportLinkBelowShare()

  // Chromium desktop has no Web Share API, so this exercises the download
  // fallback — the same path a real mobile browser falls back to when the
  // share sheet is refused. The mobile share-sheet path itself is proven by
  // unit tests against a fake `navigator` (see `exportAction.test.ts`); real
  // mobile Safari is an outstanding human verification step (see the
  // ticket-25 commit message for the checklist).
  const downloadPromise = page.waitForEvent('download')
  await root.pressExportWav()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('boop.wav')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
