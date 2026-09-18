import type { Page } from '@playwright/test'

import { LAUNCH_KIT_URL } from '../engine/kitManifest.ts'

/**
 * Flag one launch-kit instrument as pitched for this page only. Nothing on main
 * is (spec §11 - ticket 10 is the activation), so a lane test has to make its
 * own: the real manifest is fetched and patched, which is exactly the edit
 * ticket 10 will make, and keeps the roster out of the test.
 */
export async function routePitchedKit(
  page: Page,
  instrumentId: string,
  rootNote = 'G3',
): Promise<void> {
  await page.route(`**${LAUNCH_KIT_URL}`, async (route) => {
    const manifest = (await (await route.fetch()).json()) as {
      instruments: { instrumentId: string; pitched?: unknown }[]
    }
    const entry = manifest.instruments.find((i) => i.instrumentId === instrumentId)
    if (!entry) throw new Error(`the launch kit has no "${instrumentId}" to make pitched`)
    entry.pitched = { rootNote }
    await route.fulfill({ json: manifest })
  })
}
