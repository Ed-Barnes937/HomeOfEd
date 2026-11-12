import type { ProfileKeys } from '@hoe/accounts'

import { SAVE_KEY, SWORD_SAVE_KEY } from './storage.ts'

/** The keys that belong to a player rather than the device (ADR 0094): each kind's counter and shelf.
 *  The last shop (`armoury:shop`) is the device's and passes through. */
export const PROFILE_KEYS: ProfileKeys = { keys: [SAVE_KEY, SWORD_SAVE_KEY] }
