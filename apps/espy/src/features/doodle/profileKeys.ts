import type { ProfileKeys } from '@hoe/accounts'

import { SESSION_KEY } from './session.ts'

/** The keys that belong to a player rather than the device (ADR 0094): the current drawing. */
export const PROFILE_KEYS: ProfileKeys = { keys: [SESSION_KEY] }
