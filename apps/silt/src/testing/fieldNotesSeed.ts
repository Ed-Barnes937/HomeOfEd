// Node side of the .iwft harness: puts field-notes progression on the page
// before the app mounts and reads it, so a test can start from a player who has
// already witnessed things without simulating their way there.
import type { Page } from '@playwright/test'

import { entryIndex } from '../features/fieldNotes/entries.ts'
import { PROGRESS_KEY, PROGRESS_VERSION } from '../features/fieldNotes/fieldNotesStore.ts'

/**
 * Masters an element the way the sim eventually will: every entry that names it,
 * written into field notes' own key. The edges come off the live index rather
 * than a list here, so mud's five becoming six changes the roster and not the
 * tests.
 */
export async function seedMastery(page: Page, elementName: string): Promise<void> {
  const edges = entryIndex().entriesFor(elementName)
  await page.evaluate(({ key, blob }) => window.localStorage.setItem(key, blob), {
    key: PROGRESS_KEY,
    blob: JSON.stringify({ version: PROGRESS_VERSION, edges, reviewed: edges.length }),
  })
}
