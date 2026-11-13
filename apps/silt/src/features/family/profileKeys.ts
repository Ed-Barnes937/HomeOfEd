import type { ProfileKeys } from '@hoe/accounts'

import { PROGRESS_KEY } from '../fieldNotes/fieldNotesStore.ts'

/**
 * The localStorage keys that belong to a player rather than the device (ADR 0094).
 * Scenes are not here: they live in IndexedDB, per player (ADR 0102); the hint flag stays out.
 */
export const PROFILE_KEYS: ProfileKeys = { keys: [PROGRESS_KEY] }
