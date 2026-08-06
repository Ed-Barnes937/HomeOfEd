/**
 * Debounced autosave of the working grid. Edits arrive in bursts (a child
 * drag-painting a row), so writes wait for a lull rather than firing per cell —
 * but a burst that never lulls still gets written, and `flush()` covers the tab
 * going away mid-burst.
 */

import type { StoredCreation } from './saveFormat.ts'
import { writeWorkingCreation, type SaveStorage } from './storage.ts'

/** Groove Pizza's reference: save once the edits have been quiet this long. */
export const AUTOSAVE_LULL_MS = 2_000

/** …and at least this often while they never are, so a crash costs seconds. */
export const AUTOSAVE_MAX_WAIT_MS = 10_000

export interface Autosave {
  /** Record the latest working grid; writes after a lull, or at the max wait. */
  schedule(creation: StoredCreation): void
  /** Write anything pending right now. */
  flush(): void
  /** Cancel anything pending and stop. */
  dispose(): void
}

export function createAutosave(storage: SaveStorage): Autosave {
  let pending: StoredCreation | null = null
  let lullTimer: ReturnType<typeof setTimeout> | null = null
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null

  function cancel(): void {
    if (lullTimer !== null) clearTimeout(lullTimer)
    if (maxWaitTimer !== null) clearTimeout(maxWaitTimer)
    lullTimer = null
    maxWaitTimer = null
  }

  function flush(): void {
    cancel()
    if (pending === null) return
    const creation = pending
    pending = null
    writeWorkingCreation(storage, creation)
  }

  return {
    schedule(creation) {
      pending = creation
      if (lullTimer !== null) clearTimeout(lullTimer)
      lullTimer = setTimeout(flush, AUTOSAVE_LULL_MS)
      // Started by the first edit of a burst and left alone by the rest, so an
      // unbroken stream of edits still reaches disk every AUTOSAVE_MAX_WAIT_MS.
      maxWaitTimer ??= setTimeout(flush, AUTOSAVE_MAX_WAIT_MS)
    },
    flush,
    dispose() {
      cancel()
      pending = null
    },
  }
}
