import type { ProfileKeys } from '@hoe/accounts'

import { SAVE_KEY } from './storage.ts'

/** The keys that belong to a player rather than the device (ADR 0094): the counter and the shelf. */
export const PROFILE_KEYS: ProfileKeys = { keys: [SAVE_KEY] }
