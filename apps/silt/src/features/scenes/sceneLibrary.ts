/** One page's scenes for the player it opened for, and the messages a person sees (ADR 0102). */
import { moveLegacyScenes, type LegacyStorage } from './legacyScenes.ts'
import {
  DEVICE_NAMESPACE,
  SceneRecordsClosedError,
  type SceneRecords,
  type SceneRow,
  type StoredScene,
} from './sceneRecords.ts'
import { packScene, packThumbnail, thumbnailUrl, unpackScene } from './storedScene.ts'

/** A list row. Names and timestamps live here, never inside the envelope. */
export interface SceneMeta {
  id: string
  name: string
  updatedAt: number
}

export interface LibraryScene extends SceneMeta {
  /** PNG data URL, or `null` for a scene saved without one. */
  thumbnail: string | null
}

/** A storage failure worth showing to a person, message and all. */
export class SceneStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SceneStorageError'
  }
}

export const QUOTA_MESSAGE = 'storage full, delete a scene'
export const NO_STORAGE_MESSAGE = 'scenes cannot be saved on this browser'
export const CLOSED_MESSAGE = 'silt was updated in another tab, reload to keep saving scenes'
export const BLOCKED_MESSAGE = 'close silt in your other tabs to open your scenes'
const MISSING_MESSAGE = 'this scene’s data is missing from storage'

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

function toPersonError(error: unknown): unknown {
  if (error instanceof SceneStorageError) return error
  if (isQuotaError(error)) return new SceneStorageError(QUOTA_MESSAGE)
  if (error instanceof SceneRecordsClosedError) return new SceneStorageError(CLOSED_MESSAGE)
  return error
}

export interface SceneLibraryOptions {
  /** The device's localStorage, to move old scenes out of; `null` where it is refused. */
  legacy: LegacyStorage | null
  now?: () => number
  newId?: () => string
  /** Asked once, after the first save that lands, to keep storage from eviction. */
  keepStorage?: () => Promise<void>
}

export class SceneLibrary {
  readonly #records: Promise<SceneRecords>
  readonly #namespace: string
  readonly #now: () => number
  readonly #newId: () => string
  readonly #listeners = new Set<(message: string) => void>()
  #keepStorage: (() => Promise<void>) | undefined

  /** `open` is handed `notice`, for what storage has to say later (another tab, an upgrade). */
  constructor(
    open: (notice: (message: string) => void) => Promise<SceneRecords>,
    namespace: string,
    options: SceneLibraryOptions,
  ) {
    this.#namespace = namespace
    this.#now = options.now ?? (() => Date.now())
    this.#newId = options.newId ?? (() => crypto.randomUUID())
    this.#keepStorage = options.keepStorage
    const notice = (message: string): void => {
      for (const listener of this.#listeners) listener(message)
    }
    this.#records = open(notice).then(
      async (opened) => {
        await this.#prepare(opened, options.legacy)
        return opened
      },
      () => {
        throw new SceneStorageError(NO_STORAGE_MESSAGE)
      },
    )
    // Every operation reports a failure to open; this keeps it from also going unhandled.
    this.#records.catch(() => undefined)
  }

  /** Something the page should say about storage that no operation asked for. */
  onNotice(listener: (message: string) => void): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  list(): Promise<LibraryScene[]> {
    return this.#run(async (records) =>
      (await records.list(this.#namespace)).map(({ id, name, updatedAt, thumbnail }) => ({
        id,
        name,
        updatedAt,
        thumbnail: thumbnail ? thumbnailUrl(thumbnail) : null,
      })),
    )
  }

  read(id: string): Promise<string> {
    return this.#run(async (records) => unpackScene((await this.#stored(records, id)).body))
  }

  save(name: string, json: string, thumbnail: string | null): Promise<SceneMeta> {
    return this.#run(async (records) => {
      const now = this.#now()
      const scene = this.#scene(
        { id: this.#newId(), name, updatedAt: now, order: now },
        json,
        thumbnail,
      )
      await withoutPictureIfFull(scene, (next) => records.create(this.#namespace, next))
      this.#saved()
      return { id: scene.id, name, updatedAt: now }
    })
  }

  /** Writes over a scene that is still there; one that has gone stays gone. */
  update(id: string, json: string, thumbnail: string | null): Promise<void> {
    return this.#run(async (records) => {
      const row = (await records.list(this.#namespace)).find((scene) => scene.id === id)
      if (!row) return
      const scene = this.#scene({ ...row, updatedAt: this.#now() }, json, thumbnail)
      await withoutPictureIfFull(scene, (next) => records.update(this.#namespace, next))
      this.#saved()
    })
  }

  /** Fork a scene: its stored bytes under a new id and a new row. */
  duplicate(id: string, name: string): Promise<SceneMeta> {
    return this.#run(async (records) => {
      const original = await this.#stored(records, id)
      const now = this.#now()
      const copy = { ...original, id: this.#newId(), name, updatedAt: now, order: now }
      await records.create(this.#namespace, copy)
      return { id: copy.id, name, updatedAt: now }
    })
  }

  /** A rename is a change to the row, so it moves `updatedAt` like a save does. */
  rename(id: string, name: string): Promise<void> {
    return this.#run((records) => records.rename(this.#namespace, id, name, this.#now()))
  }

  remove(id: string): Promise<void> {
    return this.#run((records) => records.remove(this.#namespace, id))
  }

  async #prepare(records: SceneRecords, legacy: LegacyStorage | null): Promise<void> {
    // Neither failure stops the page: both are tried again on the next open.
    if (legacy) {
      try {
        await moveLegacyScenes(records, legacy, this.#now)
      } catch (error) {
        // Adopting now would copy a device namespace still missing the scenes being moved.
        console.warn('silt scenes: could not move scenes out of localStorage yet', error)
        return
      }
    }
    if (this.#namespace !== DEVICE_NAMESPACE) {
      await records
        .adopt(DEVICE_NAMESPACE, this.#namespace)
        .catch((error: unknown) =>
          console.warn('silt scenes: could not copy the device’s scenes yet', error),
        )
    }
  }

  #saved(): void {
    const keep = this.#keepStorage
    this.#keepStorage = undefined
    if (!keep) return
    // Never lets the request, or its refusal, touch the save that triggered it.
    void Promise.resolve()
      .then(keep)
      .catch(() => undefined)
  }

  async #stored(records: SceneRecords, id: string): Promise<StoredScene> {
    const stored = await records.read(this.#namespace, id)
    if (!stored) throw new SceneStorageError(MISSING_MESSAGE)
    return stored
  }

  #scene(row: SceneRow, json: string, thumbnail: string | null): StoredScene {
    const { id, name, updatedAt, order } = row
    const png = thumbnail ? packThumbnail(thumbnail) : null
    return { id, name, updatedAt, order, body: packScene(json), thumbnail: png }
  }

  async #run<T>(work: (records: SceneRecords) => Promise<T>): Promise<T> {
    try {
      return await work(await this.#records)
    } catch (error) {
      throw toPersonError(error)
    }
  }
}

/** The picture is decoration: a scene that only fits without it is saved without it. */
async function withoutPictureIfFull(
  scene: StoredScene,
  write: (scene: StoredScene) => Promise<unknown>,
): Promise<void> {
  try {
    await write(scene)
  } catch (error) {
    if (!isQuotaError(error) || scene.thumbnail === null) throw error
    await write({ ...scene, thumbnail: null })
  }
}
