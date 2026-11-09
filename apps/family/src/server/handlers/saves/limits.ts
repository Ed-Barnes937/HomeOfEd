/**
 * The v1 save quotas, defined in `@hoe/accounts` so the fake every consuming
 * app tests against refuses exactly what these handlers refuse. silt
 * renegotiates both byte limits at slice two, together with the hoe-pg volume
 * step; change them there, not here.
 */
export { MAX_ACCOUNT_BYTES, MAX_ACCOUNT_SLOTS, MAX_SLOT_BYTES } from '@hoe/accounts'
