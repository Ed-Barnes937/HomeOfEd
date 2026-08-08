import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('every saved boop has an Export button that downloads it as a WAV, no modal', async ({
  mountApp,
}) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()
  await root.toggleCell('kick', 0)

  // Export means "export this saved boop" (ticket 34) — there is no export in
  // the top bar any more, so saving is the way in.
  await expect(page.getByTestId('export-wav-button')).toHaveCount(0)
  await root.openBoops()
  await root.saveBoop()

  // Chromium desktop has no Web Share API, so this exercises the download
  // fallback — the same path a real mobile browser falls back to when the
  // share sheet is refused. The mobile share-sheet path itself is proven by
  // unit tests against a fake `navigator` (see `exportAction.test.ts`); real
  // mobile Safari is an outstanding human verification step (see the
  // ticket-25 commit message for the checklist).
  const downloadPromise = page.waitForEvent('download')
  await root.exportBoop(0)
  const download = await downloadPromise

  // The row's own name, slugged (ticket 34).
  expect(download.suggestedFilename()).toBe('boop-1.wav')
  await expect(page.getByRole('dialog')).toHaveCount(1)
})

test('a renamed boop exports under its own slugged name', async ({ mountApp }) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()
  await root.toggleCell('kick', 0)

  await root.openBoops()
  await root.saveBoop()
  await root.renameBoop(0, 'My Best Beat!')

  const downloadPromise = page.waitForEvent('download')
  await root.exportBoop(0)
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('my-best-beat.wav')
})

test('a double-tap on Export cannot start a second render', async ({ mountApp }) => {
  const { root, page } = await mountApp()
  await root.verifyIsShown()
  await root.toggleCell('kick', 0)

  await root.openBoops()
  await root.saveBoop()

  const downloads: unknown[] = []
  page.on('download', (download) => downloads.push(download))

  // Both taps land in the same task, before React has re-rendered the button as
  // disabled — the guard has to hold on its own.
  await root.doubleTapExport(0)
  await expect.poll(() => downloads.length).toBe(1)
  // The button lights up again only once the render is done, so a second render
  // kicked off alongside the first has had its whole life by this point.
  await root.verifyBoopExportEnabled(0)
  expect(downloads).toHaveLength(1)
})
