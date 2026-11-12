/** Where silt's scenes are kept, per namespace (ADR 0102); `MemorySceneRecords` is the tests' fake. */
import type { SceneBody } from './storedScene.ts'

/** No account: the device's scenes, by `profileScopedKey`'s rule. */
export const DEVICE_NAMESPACE = ''

export interface SceneRow {
  id: string
  name: string
  updatedAt: number
  /** Where the row sits in the list: creation time, or the batch position for moved scenes. */
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
  /**
   * Adds each scene whose id this namespace has never imported and does not
   * hold, after its current last row, and remembers every id given; durable
   * once it resolves.
   */
  importOnce(namespace: string, scenes: readonly StoredScene[]): Promise<number>
  /**
   * Until `to` has adopted once, copies every scene of `from` that `to` lacks,
   * all or nothing. Later calls do nothing.
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

/** The first order after every row given, for a batch that goes on the end. */
export function nextOrder(rows: readonly SceneRow[]): number {
  return rows.reduce((last, row) => Math.max(last, row.order + 1), 0)
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

/** The in-memory fake. A write that would pass `quotaBytes`, or cannot be cloned, changes nothing. */
export class MemorySceneRecords implements SceneRecords {
  quotaBytes: number
  readonly #scenes = new Map<string, Map<string, StoredScene>>()
  readonly #imported = new Map<string, Set<string>>()
  readonly #adopted = new Set<string>()

  constructor(options: { quotaBytes?: number } = {}) {
    this.quotaBytes = options.quotaBytes ?? Number.POSITIVE_INFINITY
  }

  usedBytes(): number {
    let total = 0
    for (const scenes of this.#scenes.values()) {
      for (const scene of scenes.values()) total += sceneBytes(scene)
    }
    return total
  }

  list(namespace: string): Promise<ListedScene[]> {
    return settled(() =>
      [...this.#in(namespace).values()].sort(byListOrder).map((scene) => ({
        id: scene.id,
        name: scene.name,
        updatedAt: scene.updatedAt,
        order: scene.order,
        thumbnail: scene.thumbnail === null ? null : structuredClone(scene.thumbnail),
      })),
    )
  }

  read(namespace: string, id: string): Promise<StoredScene | null> {
    return settled(() => {
      const scene = this.#in(namespace).get(id)
      return scene ? structuredClone(scene) : null
    })
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

  importOnce(namespace: string, scenes: readonly StoredScene[]): Promise<number> {
    return settled(() => {
      const imported = this.#imported.get(namespace) ?? new Set<string>()
      const held = this.#in(namespace)
      const base = nextOrder([...held.values()])
      const fresh = scenes.filter((scene) => !imported.has(scene.id) && !held.has(scene.id))
      this.#commit(fresh.map((scene) => [namespace, { ...scene, order: base + scene.order }]))
      this.#imported.set(namespace, new Set([...imported, ...scenes.map((scene) => scene.id)]))
      return fresh.length
    })
  }

  adopt(from: string, to: string): Promise<void> {
    return settled(() => {
      if (this.#adopted.has(to)) return
      const held = this.#in(to)
      const missing = [...this.#in(from).values()].filter((scene) => !held.has(scene.id))
      this.#commit(missing.map((scene) => [to, scene]))
      this.#adopted.add(to)
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

  // Validated whole before anything is written, as one IndexedDB transaction would be.
  #commit(writes: readonly (readonly [string, StoredScene])[]): void {
    const copies = writes.map(([namespace, scene]) => [namespace, structuredClone(scene)] as const)
    let total = 0
    for (const [namespace, scenes] of this.#scenes) {
      for (const scene of scenes.values()) {
        const replaced = copies.some(([ns, next]) => ns === namespace && next.id === scene.id)
        if (!replaced) total += sceneBytes(scene)
      }
    }
    for (const [, scene] of copies) total += sceneBytes(scene)
    if (total > this.quotaBytes) throw quotaExceeded()
    for (const [namespace, scene] of copies) this.#in(namespace).set(scene.id, scene)
  }
}

/** Runs `work` as a promise would, so a throw arrives as a rejection. */
function settled<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => resolve(work()))
}
