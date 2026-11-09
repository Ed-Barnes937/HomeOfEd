// Browser side of the family-account harness (ADR 0080). A page reload does not
// bring the harness bundle back until the next mount, so a test cannot reach
// the in-page fake between the two - it leaves the state it wants under this
// key instead, and the harness applies it at module init, before the app's
// first pull. Same shape as test-kit's SEED_SOURCE_KEY trampoline.
import type { FakeSessionInput } from '@hoe/accounts/testing'
import type { FakeFamilyClient } from '@hoe/accounts/testing/fake'

import { SAVE_KEY } from '../persistence/storage.ts'
import { BOOP_APP_ID } from '../sync/boopSync.ts'

export const FAMILY_SEED_KEY = '__boopFamilySeed'

export interface FamilySeed {
  /** The profile the fake service knows is playing. */
  session?: FakeSessionInput
  /** A save document already on the account - what another device left behind. */
  remote?: string
  /** Make every call throw, as an unreachable service does. */
  broken?: boolean
}

/** Left in place rather than consumed, so a reload inside one test re-applies it. */
export function applyFamilySeed(client: FakeFamilyClient): void {
  let seed: FamilySeed
  try {
    const raw = window.localStorage.getItem(FAMILY_SEED_KEY)
    if (raw === null) return
    seed = JSON.parse(raw) as FamilySeed
  } catch {
    return
  }

  if (seed.session) client.signInAs(seed.session)
  if (seed.remote !== undefined) {
    void client
      .put({ appId: BOOP_APP_ID, slotKey: SAVE_KEY, blob: seed.remote })
      .catch(() => undefined)
  }
  // After the put, whose guard is read when it is called, so the seeded slot
  // still lands on a service the test wants broken from the app's first call.
  if (seed.broken) client.failWith(new Error('the family service is unreachable'))
}
