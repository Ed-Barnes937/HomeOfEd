import { useEffect, useRef, useState } from 'react'

import type { SceneLibrary } from './sceneLibrary.ts'
import type { SceneRow } from './ScenesPopover.tsx'

export interface UseScenesOptions {
  /** The world as a scene envelope plus a thumbnail — `useSimLoop.saveScene`. */
  saveScene: () => { json: string; thumbnail: string | null }
  /** Apply a scene to the world, returning non-fatal warnings — `useSimLoop.loadScene`. */
  loadScene: (json: string) => string[]
  /** Called after a successful load. Loads enter paused (spec §8). */
  onLoaded: () => void
  /** The page's scenes, for the player it opened for; read once. */
  library: SceneLibrary
}

export interface ScenesController {
  /** `null` until the list has been read, so an empty list is never shown by mistake. */
  scenes: readonly SceneRow[] | null
  /** Why scenes cannot be kept here at all, or `null`. */
  unavailable: string | null
  /** Some save, load or other scene operation has not finished yet. */
  busy: boolean
  status: { tone: 'ok' | 'error'; text: string } | null
  /** The scene a save would write to, by name, or `null` for an unsaved world. */
  currentName: string | null
  save: () => void
  load: (id: string) => void
  rename: (id: string, name: string) => void
  duplicate: (id: string) => void
  delete: (id: string) => void
  /** The world on screen is nobody's scene any more — the next save creates one. */
  clearCurrentScene: () => void
}

/** The first `scene N` nobody is using, so two saves never share a name. */
function nextName(taken: ReadonlySet<string>): string {
  for (let n = 1; ; n++) {
    const name = `scene ${n}`
    if (!taken.has(name)) return name
  }
}

/** `dunes copy`, then `dunes copy 2` — a fork says what it was forked from. */
function copyName(of: string, taken: ReadonlySet<string>): string {
  const base = `${of} copy`
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const name = `${base} ${n}`
    if (!taken.has(name)) return name
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The page's scene list: the rows the popover renders, and the
 * save/load/rename/delete operations with their failure messages. Failures are
 * surfaced, never swallowed, and never delete anything (spec §8) — a scene
 * that will not load keeps its row and gains an error. Storage is
 * asynchronous (ADR 0102), so operations run one at a time, in the order asked:
 * a second save never races the first into creating two scenes.
 */
export function useScenes(options: UseScenesOptions): ScenesController {
  // Synced in an effect, not during render (ticket 15) — a render-phase write
  // misbehaves under concurrent rendering and StrictMode double-invocation.
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })
  const [library] = useState(() => options.library)

  const [scenes, setScenes] = useState<readonly SceneRow[] | null>(null)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  // The scene on screen: a save writes to it, a load and a first save set it.
  // The ref is what queued work reads, since it runs after renders it cannot see.
  const [currentId, setCurrentIdState] = useState<string | null>(null)
  const currentIdRef = useRef<string | null>(null)
  const setCurrentId = (id: string | null): void => {
    currentIdRef.current = id
    setCurrentIdState(id)
  }
  // Load failures are per-scene, so they outlive the one-line status.
  const errorsRef = useRef<Record<string, string>>({})
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const [pending, setPending] = useState(0)

  const refresh = async (): Promise<readonly SceneRow[]> => {
    const listed = (await library.list()).map((scene) => ({
      ...scene,
      error: errorsRef.current[scene.id] ?? null,
    }))
    setScenes(listed)
    return listed
  }

  const enqueue = (work: () => Promise<void>): void => {
    setPending((count) => count + 1)
    queueRef.current = queueRef.current.then(async () => {
      try {
        await work()
      } catch (error) {
        setStatus({ tone: 'error', text: messageOf(error) })
        await refresh().catch(() => undefined)
      } finally {
        setPending((count) => count - 1)
      }
    })
  }

  useEffect(() => {
    const stop = library.onNotice((text) => setStatus({ tone: 'error', text }))
    // The first read also moves old scenes out of localStorage and adopts the device's.
    enqueue(async () => {
      try {
        await refresh()
      } catch (error) {
        setUnavailable(messageOf(error))
      }
    })
    return stop
  }, [library])

  return {
    scenes,
    unavailable,
    busy: pending > 0,
    status,
    // Read off the list, so a rename of the current scene carries into it.
    currentName: scenes?.find((scene) => scene.id === currentId)?.name ?? null,

    // Save writes to the scene being edited (spec §8's `updatedAt`); only a
    // world that has never been saved, or one whose scene has been deleted
    // under it, creates a row. The world is read when the save's turn comes.
    save: () =>
      enqueue(async () => {
        const listed = await library.list()
        const { json, thumbnail } = optionsRef.current.saveScene()
        const current = listed.find((scene) => scene.id === currentIdRef.current)
        if (current) {
          await library.update(current.id, json, thumbnail)
          await refresh()
          setStatus({ tone: 'ok', text: `saved ${current.name}` })
          return
        }
        const name = nextName(new Set(listed.map((scene) => scene.name)))
        const meta = await library.save(name, json, thumbnail)
        setCurrentId(meta.id)
        await refresh()
        setStatus({ tone: 'ok', text: `saved ${meta.name}` })
      }),

    load: (id) =>
      enqueue(async () => {
        const name = (await library.list()).find((scene) => scene.id === id)?.name ?? 'scene'
        let warnings: string[]
        try {
          warnings = optionsRef.current.loadScene(await library.read(id))
        } catch (error) {
          // Never destructive: the scene stays, the row stays, the row explains.
          errorsRef.current = { ...errorsRef.current, [id]: messageOf(error) }
          await refresh()
          setStatus({ tone: 'error', text: `could not load ${name}` })
          return
        }
        delete errorsRef.current[id]
        for (const warning of warnings) console.warn(`silt scene: ${warning}`)
        // What is on screen is now this scene, so this is what a save writes to.
        setCurrentId(id)
        await refresh()
        // A warning means the load succeeded and lost something — said out
        // loud, but not in the tone reserved for "this did not happen".
        setStatus({
          tone: 'ok',
          text: warnings.length > 0 ? `loaded ${name} — ${warnings[0]}` : `loaded ${name}`,
        })
        optionsRef.current.onLoaded()
      }),

    // Every operation reports (spec §8 "loud, never silent") — leaving the
    // previous op's line on screen reads as if this one had not landed.
    rename: (id, name) =>
      enqueue(async () => {
        await library.rename(id, name)
        await refresh()
        setStatus({ tone: 'ok', text: `renamed to ${name}` })
      }),

    clearCurrentScene: () => setCurrentId(null),

    // Save updates in place, so this is the way to keep the version you have
    // and carry on from it — load the copy to continue in the fork.
    duplicate: (id) =>
      enqueue(async () => {
        const listed = await library.list()
        const of = listed.find((scene) => scene.id === id)?.name ?? 'scene'
        const meta = await library.duplicate(
          id,
          copyName(of, new Set(listed.map((scene) => scene.name))),
        )
        await refresh()
        setStatus({ tone: 'ok', text: `copied to ${meta.name}` })
      }),

    delete: (id) =>
      enqueue(async () => {
        const name = (await library.list()).find((scene) => scene.id === id)?.name ?? 'scene'
        await library.remove(id)
        // The world stays on screen, but it no longer belongs to a scene: the
        // next save makes a new one rather than resurrecting a deleted row.
        if (id === currentIdRef.current) setCurrentId(null)
        delete errorsRef.current[id]
        await refresh()
        setStatus({ tone: 'ok', text: `deleted ${name}` })
      }),
  }
}
