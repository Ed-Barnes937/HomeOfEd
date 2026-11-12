import type { ProfileKeys } from '@hoe/accounts'

import { STORAGE_KEY } from './serialize.ts'

/** The board and its saved fridges belong to a player (ADR 0094); the landscape nudge is the device's. */
export const PROFILE_KEYS: ProfileKeys = { keys: [STORAGE_KEY] }
