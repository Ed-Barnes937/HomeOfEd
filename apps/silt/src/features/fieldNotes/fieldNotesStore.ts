/**
 * The localStorage half of field notes (spec §5). Progression is **global, not
 * per scene**: one small key of its own, holding the witnessed edge keys and
 * nothing derived - discovery, mastery and the rail unlock are all recomputed
 * from the edges by `entries.ts` on every load, so stored state can never
 * disagree with the roster it is read against.
 *
 * The `FieldNotesStorage` seam is what lets all of this be tested without a
 * browser, exactly as `sceneStore.ts` does for scenes. Quota is a non-issue
 * here - the blob only ever grows to a few dozen short strings - so unlike
 * scenes there is no quota vocabulary to speak.
 *
 * This module knows nothing about what an edge key *means*: unknown keys are
 * carried through a save/load cycle untouched (spec §5, forward-compat) and the
 * derivations ignore what this roster cannot resolve.
 */
import type { EdgeKey } from './edgeKeys.ts'

/** The slice of the `Storage` API field notes use. `localStorage` satisfies it. */
export interface FieldNotesStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const PROGRESS_KEY = 'silt:fieldNotes'

/** Bumped only by a change this format cannot read; an older blob is discarded. */
export const PROGRESS_VERSION = 1

/** Everything that is stored. Everything else about field notes is derived. */
export interface Progress {
  /**
   * Witnessed edge keys, in the order they were first seen. Append-only, so
   * the order is a timeline - which is what `reviewed` indexes into.
   */
  edges: readonly EdgeKey[]
  /**
   * How many of `edges` the player has already been shown in the panel: the
   * watermark behind its `NEW n` chip (spec §6). A count into the timeline
   * rather than a set of element names, because names would be derived state
   * and this file stores none.
   */
  reviewed: number
}

const EMPTY: Progress = { edges: [], reviewed: 0 }

/** The stored shape, as written. `Progress` plus the version it was written at. */
interface StoredProgress extends Progress {
  version: number
}

/** A `Storage` that forgets: the fallback where localStorage is refused, and a test fake. */
export function createMemoryStorage(): FieldNotesStorage {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

/**
 * A blob is only trusted whole: right version, edges an array of strings. Half
 * a blob would be worse than none, since the derivations would quietly report
 * progress the player never made.
 */
function parse(raw: string): Progress | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

  const { version, edges, reviewed } = parsed as Partial<StoredProgress>
  if (version !== PROGRESS_VERSION) return null
  if (!Array.isArray(edges) || edges.some((key) => typeof key !== 'string')) return null

  return {
    edges,
    // A watermark past the end (or absent, or nonsense) only ever means "some
    // of what is stored is not new any more", so it is clamped, not rejected.
    reviewed:
      typeof reviewed === 'number' ? Math.min(Math.max(Math.trunc(reviewed), 0), edges.length) : 0,
  }
}

/**
 * The witnessed-edge set as it lives on disk. Loaded once at construction -
 * the blob is tiny and this store is the only writer, so re-reading it on every
 * witness would buy nothing - and written through on every change.
 */
export class FieldNotesStore {
  readonly #storage: FieldNotesStorage
  #progress: Progress

  constructor(storage: FieldNotesStorage) {
    this.#storage = storage
    this.#progress = this.#load()
  }

  /**
   * The stored progression. Its identity only changes when something has
   * actually changed, so the hook can hang React state straight off it.
   */
  get progress(): Progress {
    return this.#progress
  }

  /**
   * Records first witnesses, ignoring keys already known (a re-reported first
   * is a no-op that must not touch storage). Reports whether anything was new,
   * so the caller need not diff to know it has a render to do.
   */
  witness(keys: readonly EdgeKey[]): boolean {
    const known = new Set(this.#progress.edges)
    const fresh: EdgeKey[] = []
    for (const key of keys) {
      if (known.has(key)) continue
      // Added as it is taken, so a key repeated inside one batch is deduped too.
      known.add(key)
      fresh.push(key)
    }
    if (fresh.length === 0) return false

    this.#write({ ...this.#progress, edges: [...this.#progress.edges, ...fresh] })
    return true
  }

  /**
   * Everything witnessed so far has now been shown to the player, so it stops
   * counting as new. **Call this when the panel closes, not when it opens**:
   * advancing the watermark on open would empty the `NEW n` chip on the very
   * render that exists to show it. Reports whether the watermark moved, so
   * closing a panel that showed nothing new writes nothing.
   */
  markReviewed(): boolean {
    const { edges, reviewed } = this.#progress
    if (reviewed === edges.length) return false

    this.#write({ edges, reviewed: edges.length })
    return true
  }

  /**
   * "Forget discoveries" (spec §5): the key goes entirely, rather than being
   * left as an empty blob claiming a player who has witnessed nothing. Note
   * what does *not* do this - clearing or reloading the world never resets
   * discovery, which is why this is the only path here that removes anything.
   */
  reset(): void {
    this.#storage.removeItem(PROGRESS_KEY)
    this.#progress = EMPTY
  }

  #load(): Progress {
    const raw = this.#storage.getItem(PROGRESS_KEY)
    if (raw === null) return EMPTY

    const parsed = parse(raw)
    if (parsed) return parsed

    // Loud, but never fatal and never destructive: the player carries on with
    // an empty chart, and the bytes stay until a real write replaces them.
    console.warn('silt field notes: stored progress could not be read, starting empty')
    return EMPTY
  }

  #write(progress: Progress): void {
    const stored: StoredProgress = { version: PROGRESS_VERSION, ...progress }
    this.#storage.setItem(PROGRESS_KEY, JSON.stringify(stored))
    this.#progress = progress
  }
}
