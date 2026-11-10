import type { ProfileKeys } from '@hoe/accounts'

import { PROGRESS_KEY } from '../fieldNotes/fieldNotesStore.ts'
import { THUMB_PREFIX } from '../scenes/sceneStore.ts'

/** The keys that belong to a player rather than the device (ADR 0094); the hint flag stays out. */
export const PROFILE_KEYS: ProfileKeys = {
  keys: [PROGRESS_KEY],
  // One prefix for the index (`silt:scenes`) and every blob (`silt:scene:<id>`), so a
  // profile adopts them together or not at all and never gets rows without blobs.
  prefixes: ['silt:scene', THUMB_PREFIX],
}
