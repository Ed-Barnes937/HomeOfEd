import type { ProfileKeys } from '@hoe/accounts'

import { FAVOURITES_KEY } from './favourites.ts'
import { SAVE_KEY } from './storage.ts'

/** The keys that belong to a player rather than the device (ADR 0094); device preferences stay out. */
export const PROFILE_KEYS: ProfileKeys = { keys: [SAVE_KEY, FAVOURITES_KEY] }
