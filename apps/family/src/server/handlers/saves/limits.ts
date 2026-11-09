/**
 * The v1 save quotas (spec §4.6). boop documents are a few KB; silt renegotiates
 * both at slice two, together with the hoe-pg volume step.
 */
export const MAX_SLOT_BYTES = 256 * 1024

/** Across every appId, so one app cannot crowd out another on the same account. */
export const MAX_ACCOUNT_BYTES = 2 * 1024 * 1024

/**
 * Bytes alone do not bound the store: an empty blob is free and `slotKey` is
 * the app's own string, so row count needs its own ceiling. Generous for a
 * scene-per-slot app like silt, and far above boop's single slot.
 */
export const MAX_ACCOUNT_SLOTS = 64
