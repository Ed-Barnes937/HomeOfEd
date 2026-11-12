/**
 * The seam between silt's scenes and where they are kept (ADR 0102). Every
 * record belongs to a namespace: the playing account's id, or
 * `DEVICE_NAMESPACE` for no account, by the same rule as `profileScopedKey`.
 * `indexedDbSceneRecords.ts` is the real one; `MemorySceneRecords` is the fake
 * the tests use, held to the same contract (`sceneRecords.test.ts`).
 */
import type { SceneBody } from './storedScene.ts'

export const DEVICE_NAMESPACE = ''

export interface SceneRow {
  id: string
  name: string
  updatedAt: number
  /** Where the row sits in the list: creation time, or the old index position for moved scenes. */
  order: number
}

export interface StoredScene extends SceneRow {
  body: SceneBody
  /** PNG bytes, or `null` for a scene with no picture. */
  thumbnail: Uint8Array | null
}

export interface ListedScene extends SceneRow {
  thumbnail: Uint8Array | null
}

export interface SceneRecords {
  /** The namespace's rows in list order, with their thumbnails. */
  list(namespace: string): Promise<ListedScene[]>
  read(namespace: string, id: string): Promise<StoredScene | null>
  /** A new scene: row, body and thumbnail land together or not at all. */
  create(namespace: string, scene: StoredScene): Promise<void>
  /** Rewrites a scene that exists, all or nothing; a `null` thumbnail removes the old one. */
  update(namespace: string, scene: StoredScene): Promise<boolean>
  rename(namespace: string, id: string, name: string, updatedAt: number): Promise<void>
  remove(namespace: string, id: string): Promise<void>
  /** Adds each scene whose id is not in the namespace yet; resolves once that is committed. */
  addMissing(namespace: string, scenes: readonly StoredScene[]): Promise<number>
  /**
   * The first time `to` opens, copies every scene in `from` into it, all or
   * nothing, unless `to` already holds scenes. Later calls do nothing.
   */
  adopt(from: string, to: string): Promise<void>
}

/** The database was closed under the page, by an upgrade in another tab or the browser. */
export class SceneRecordsClosedError extends Error {
  constructor() {
    super('scene storage was closed')
    this.name = 'SceneRecordsClosedError'
  }
}

export function quotaExceeded(): DOMException {
  return new DOMException('the scene quota is full', 'QuotaExceededError')
}

export function byListOrder(a: SceneRow, b: SceneRow): number {
  return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** Bytes a scene costs, as the fake's quota counts them. */
export function sceneBytes(scene: StoredScene): number {
  const body =
    scene.body.kind === 'json'
      ? scene.body.json.length
      : JSON.stringify(scene.body.envelope).length +
        scene.body.planes.species.byteLength +
        scene.body.planes.ra.byteLength +
        scene.body.planes.rb.byteLength
  return body + (scene.thumbnail?.byteLength ?? 0) + scene.name.length
}

/** The in-memory fake. `quotaBytes` makes a write that would pass it fail, changing nothing. */
export class MemorySceneRecords implements SceneRecords {
  readonly #scenes = new Map<string, Map<string, StoredScene>>()
  readonly #opened = new Set<string>()
  readonly #quotaBytes: number

  constructor(options: { quotaBytes?: number } = {}) {
    this.#quotaBytes = options.quotaBytes ?? Number.POSITIVE_INFINITY
  }

  list(namespace: string): Promise<ListedScene[]> {
    return settled(() =>
      [...this.#in(namespace).values()].sort(byListOrder).map((scene) => ({
        id: scene.id,
        name: scene.name,
        updatedAt: scene.updatedAt,
        order: scene.order,
        thumbnail: scene.thumbnail,
      })),
    )
  }

  read(namespace: string, id: string): Promise<StoredScene | null> {
    return settled(() => this.#in(namespace).get(id) ?? null)
  }

  create(namespace: string, scene: StoredScene): Promise<void> {
    return settled(() => this.#commit([[namespace, scene]]))
  }

  update(namespace: string, scene: StoredScene): Promise<boolean> {
    return settled(() => {
      if (!this.#in(namespace).has(scene.id)) return false
      this.#commit([[namespace, scene]])
      return true
    })
  }

  rename(namespace: string, id: string, name: string, updatedAt: number): Promise<void> {
    return settled(() => {
      const scene = this.#in(namespace).get(id)
      if (scene) this.#commit([[namespace, { ...scene, name, updatedAt }]])
    })
  }

  remove(namespace: string, id: string): Promise<void> {
    return settled(() => {
      this.#in(namespace).delete(id)
    })
  }

  addMissing(namespace: string, scenes: readonly StoredScene[]): Promise<number> {
    return settled(() => {
      const missing = scenes.filter((scene) => !this.#in(namespace).has(scene.id))
      this.#commit(missing.map((scene) => [namespace, scene]))
      return missing.length
    })
  }

  adopt(from: string, to: string): Promise<void> {
    return settled(() => {
      if (this.#opened.has(to)) return
      if (this.#in(to).size === 0) {
        this.#commit([...this.#in(from).values()].map((scene) => [to, scene]))
      }
      this.#opened.add(to)
    })
  }

  #in(namespace: string): Map<string, StoredScene> {
    let scenes = this.#scenes.get(namespace)
    if (!scenes) {
      scenes = new Map()
      this.#scenes.set(namespace, scenes)
    }
    return scenes
  }

  #commit(writes: readonly (readonly [string, StoredScene])[]): void {
    let total = 0
    for (const [namespace, scenes] of this.#scenes) {
      for (const scene of scenes.values()) {
        const replaced = writes.some(([ns, next]) => ns === namespace && next.id === scene.id)
        if (!replaced) total += sceneBytes(scene)
      }
    }
    for (const [, scene] of writes) total += sceneBytes(scene)
    if (total > this.#quotaBytes) throw quotaExceeded()
    for (const [namespace, scene] of writes) this.#in(namespace).set(scene.id, scene)
  }
}

/** Runs `work` as a promise would, so a throw arrives as a rejection. */
function settled<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => resolve(work()))
}
