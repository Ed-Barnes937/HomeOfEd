/**
 * The localStorage half of scene persistence (spec §8). Knows about keys,
 * quota and the index; knows nothing about the scene format itself, which is
 * an opaque JSON string here. The `SceneStorage` seam is what lets all of this
 * be tested without a browser.
 */

/** Index row. Names and timestamps live here, never inside the envelope. */
export interface SceneMeta {
  id: string
  name: string
  updatedAt: number
}

/** The slice of the `Storage` API scenes use. `localStorage` satisfies it. */
export interface SceneStorage {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** A storage failure worth showing to a person, message and all. */
export class SceneStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SceneStorageError'
  }
}

export const INDEX_KEY = 'silt:scenes'
const BLOB_PREFIX = 'silt:scene:'
const THUMB_PREFIX = 'silt:thumb:'

export function blobKey(id: string): string {
  return `${BLOB_PREFIX}${id}`
}

export function thumbKey(id: string): string {
  return `${THUMB_PREFIX}${id}`
}

/** Browsers disagree on the name and code; all of them mean "no room left". */
function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { name, code } = error as { name?: string; code?: number }
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  )
}

const QUOTA_MESSAGE = 'storage full, delete a scene'

export interface SceneStoreOptions {
  now?: () => number
  newId?: () => string
}

export class SceneStore {
  readonly #storage: SceneStorage
  readonly #now: () => number
  readonly #newId: () => string

  constructor(storage: SceneStorage, options: SceneStoreOptions = {}) {
    this.#storage = storage
    this.#now = options.now ?? (() => Date.now())
    this.#newId = options.newId ?? (() => crypto.randomUUID())
  }

  /** The index as stored. A corrupt index reads as empty; `reconcile` repairs it. */
  list(): SceneMeta[] {
    const raw = this.#storage.getItem(INDEX_KEY)
    if (!raw) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is SceneMeta =>
        typeof row === 'object' &&
        row !== null &&
        typeof (row as SceneMeta).id === 'string' &&
        typeof (row as SceneMeta).name === 'string' &&
        typeof (row as SceneMeta).updatedAt === 'number',
    )
  }

  /**
   * Boot-time repair (spec §8): index rows whose blob has gone are dropped,
   * and blobs the index never learned about — a save that died between its two
   * writes — are adopted rather than leaked. Thumbnails whose scene has gone
   * are freed, since nothing else would ever reclaim that space.
   *
   * The index is only rewritten when something actually changed: on a full
   * quota, a boot that repairs nothing must not be the thing that throws.
   */
  reconcile(): SceneMeta[] {
    const listed = this.list()
    const kept = listed.filter((scene) => this.#storage.getItem(blobKey(scene.id)) !== null)
    const known = new Set(kept.map((scene) => scene.id))

    const orphanThumbs: string[] = []
    for (let i = 0; i < this.#storage.length; i++) {
      const key = this.#storage.key(i)
      if (key?.startsWith(BLOB_PREFIX)) {
        const id = key.slice(BLOB_PREFIX.length)
        if (known.has(id)) continue
        kept.push({ id, name: 'recovered scene', updatedAt: this.#now() })
        known.add(id)
      } else if (key?.startsWith(THUMB_PREFIX)) {
        orphanThumbs.push(key)
      }
    }

    for (const key of orphanThumbs) {
      if (!known.has(key.slice(THUMB_PREFIX.length))) this.#storage.removeItem(key)
    }

    // Count is not enough: dropping one row and adopting one blob leaves it equal.
    const changed =
      kept.length !== listed.length || kept.some((scene, i) => scene.id !== listed[i]?.id)
    if (changed) this.#writeIndex(kept)
    return kept
  }

  /**
   * Blob first, index last (spec §8): a save interrupted in the middle leaves
   * an orphan blob that `reconcile` can adopt, never an index row pointing at
   * nothing. The thumbnail is decoration — losing it to quota must not lose
   * the scene.
   */
  save(name: string, json: string, thumbnail: string | null): SceneMeta {
    const meta: SceneMeta = { id: this.#newId(), name, updatedAt: this.#now() }

    this.#write(blobKey(meta.id), json)
    if (thumbnail) {
      try {
        this.#storage.setItem(thumbKey(meta.id), thumbnail)
      } catch {
        // Decoration only — a scene without a thumbnail still loads.
      }
    }
    this.#writeIndex([...this.list(), meta])

    return meta
  }

  /**
   * Re-save over an existing scene: same id, same keys, new bytes and a new
   * `updatedAt`. Same write order as `save` — the blob is the durable part and
   * goes first — but nothing is created, so the scene count and the quota
   * footprint do not move however many times the world is saved.
   */
  update(id: string, json: string, thumbnail: string | null): void {
    this.#write(blobKey(id), json)
    let pictured = false
    if (thumbnail) {
      try {
        this.#storage.setItem(thumbKey(id), thumbnail)
        pictured = true
      } catch {
        // Decoration only — a scene without a thumbnail still loads.
      }
    }
    // The previous save's thumbnail goes with it: it pictures a world this
    // scene no longer holds, and its bytes stay charged to the quota regardless.
    if (!pictured) this.#storage.removeItem(thumbKey(id))

    this.#writeIndex(
      this.list().map((scene) => (scene.id === id ? { ...scene, updatedAt: this.#now() } : scene)),
    )
  }

  /**
   * Fork a scene: the stored bytes copied under a new id. Save updates the
   * scene you are on, so this is the way to keep the version you had before
   * carrying on from it.
   */
  duplicate(id: string, name: string): SceneMeta {
    return this.save(name, this.read(id), this.thumbnail(id))
  }

  read(id: string): string {
    const json = this.#storage.getItem(blobKey(id))
    if (json === null) {
      throw new SceneStorageError('this scene’s data is missing from storage')
    }
    return json
  }

  thumbnail(id: string): string | null {
    return this.#storage.getItem(thumbKey(id))
  }

  /** A rename is a change to the row, so it moves `updatedAt` like a save does. */
  rename(id: string, name: string): void {
    this.#writeIndex(
      this.list().map((scene) =>
        scene.id === id ? { ...scene, name, updatedAt: this.#now() } : scene,
      ),
    )
  }

  /**
   * The only escape from a full quota, so it drops every key the scene owns —
   * and frees them *before* rewriting the index, which is the write that would
   * fail if there were no room. Interrupted, this leaves a dangling index row
   * that the next boot reconciles away; the other order would leave the bytes
   * stuck on disk with the escape hatch broken.
   */
  remove(id: string): void {
    this.#storage.removeItem(blobKey(id))
    this.#storage.removeItem(thumbKey(id))
    this.#writeIndex(this.list().filter((scene) => scene.id !== id))
  }

  #writeIndex(scenes: readonly SceneMeta[]): void {
    this.#write(INDEX_KEY, JSON.stringify(scenes))
  }

  #write(key: string, value: string): void {
    try {
      this.#storage.setItem(key, value)
    } catch (error) {
      if (isQuotaError(error)) throw new SceneStorageError(QUOTA_MESSAGE)
      throw error
    }
  }
}
