import { useEffect, useRef, useState } from 'react'

import type { SceneRow } from './ScenesPopover.tsx'
import { SceneStore, type SceneStorage } from './sceneStore.ts'

export interface UseScenesOptions {
  /** The world as a scene envelope plus a thumbnail — `useSimLoop.saveScene`. */
  saveScene: () => { json: string; thumbnail: string | null }
  /** Apply a scene to the world, returning non-fatal warnings — `useSimLoop.loadScene`. */
  loadScene: (json: string) => string[]
  /** Called after a successful load, with the scene's name. Loads enter paused (spec §8). */
  onLoaded: (name: string) => void
}

export interface ScenesController {
  scenes: readonly SceneRow[]
  status: { tone: 'ok' | 'error'; text: string } | null
  save: () => void
  load: (id: string) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
}

/** Private browsing modes can make even *touching* localStorage throw. */
function openStorage(): SceneStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const NO_STORAGE = 'this browser is not allowing local storage'

/** The first `scene N` nobody is using, so two saves never share a name. */
function nextName(taken: ReadonlySet<string>): string {
  for (let n = 1; ; n++) {
    const name = `scene ${n}`
    if (!taken.has(name)) return name
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The page's scene list: the store, the rows the popover renders, and the
 * save/load/rename/delete operations with their failure messages. Failures are
 * surfaced, never swallowed, and never delete anything (spec §8) — a scene
 * that will not load keeps its row and gains an error.
 */
export function useScenes(options: UseScenesOptions): ScenesController {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const storeRef = useRef<SceneStore | null>(null)
  if (storeRef.current === null) {
    const storage = openStorage()
    if (storage) storeRef.current = new SceneStore(storage)
  }

  const [scenes, setScenes] = useState<readonly SceneRow[]>([])
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  // Load failures are per-scene, so they outlive the one-line status.
  const errorsRef = useRef<Record<string, string>>({})

  const refresh = (store: SceneStore, listed = store.list()): void => {
    setScenes(
      listed.map((scene) => ({
        ...scene,
        thumbnail: store.thumbnail(scene.id),
        error: errorsRef.current[scene.id] ?? null,
      })),
    )
  }

  const withStore = (work: (store: SceneStore) => void): void => {
    const store = storeRef.current
    if (!store) {
      setStatus({ tone: 'error', text: NO_STORAGE })
      return
    }
    try {
      work(store)
    } catch (error) {
      setStatus({ tone: 'error', text: messageOf(error) })
      refresh(store)
    }
  }

  // Boot-time reconcile (spec §8): dangling index rows go, orphan blobs are
  // adopted. It goes through `withStore` like everything else — reconcile
  // writes the index, and an unguarded throw here (a full quota) would take
  // the page down with it, leaving no way to reach the delete button.
  useEffect(() => {
    // Runs once: the store is created before the first render and never replaced.
    withStore((store) => refresh(store, store.reconcile()))
  }, [])

  return {
    scenes,
    status,

    save: () =>
      withStore((store) => {
        const { json, thumbnail } = optionsRef.current.saveScene()
        const taken = new Set(store.list().map((scene) => scene.name))
        const meta = store.save(nextName(taken), json, thumbnail)
        refresh(store)
        setStatus({ tone: 'ok', text: `saved ${meta.name}` })
      }),

    load: (id) =>
      withStore((store) => {
        const name = store.list().find((scene) => scene.id === id)?.name ?? 'scene'
        let warnings: string[]
        try {
          warnings = optionsRef.current.loadScene(store.read(id))
        } catch (error) {
          // Never destructive: the blob stays, the row stays, the row explains.
          errorsRef.current = { ...errorsRef.current, [id]: messageOf(error) }
          refresh(store)
          setStatus({ tone: 'error', text: `could not load ${name}` })
          return
        }
        delete errorsRef.current[id]
        for (const warning of warnings) console.warn(`silt scene: ${warning}`)
        refresh(store)
        // A warning means the load succeeded and lost something — said out
        // loud, but not in the tone reserved for "this did not happen".
        setStatus({
          tone: 'ok',
          text: warnings.length > 0 ? `loaded ${name} — ${warnings[0]}` : `loaded ${name}`,
        })
        optionsRef.current.onLoaded(name)
      }),

    rename: (id, name) =>
      withStore((store) => {
        store.rename(id, name)
        refresh(store)
      }),

    remove: (id) =>
      withStore((store) => {
        store.remove(id)
        delete errorsRef.current[id]
        refresh(store)
        setStatus(null)
      }),
  }
}
