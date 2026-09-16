/**
 * Field notes' one seam onto the page (spec §5, §6): the store, the derived
 * view, and the three actions that move it. The header control, the panel, the
 * rail unlock and the moment cards all render this - none of them touches
 * storage or the entry index directly - so the counts on the chip, the ring and
 * the picker cannot drift apart.
 *
 * The behaviour worth testing is in the two modules below it: `fieldNotesStore`
 * (persistence) and `fieldNotesView` (the derivation). This file is the React
 * wiring between them.
 */
import { useMemo, useRef, useState } from 'react'

import type { EdgeKey } from './edgeKeys.ts'
import {
  FieldNotesStore,
  createMemoryStorage,
  type FieldNotesStorage,
  type Progress,
} from './fieldNotesStore.ts'
import { fieldNotesView, type FieldNotesView } from './fieldNotesView.ts'

export type { FieldNotesView, Tally } from './fieldNotesView.ts'

export interface FieldNotesController extends FieldNotesView {
  /** The stored progression as it is - what a scene save snapshots (ticket 28). */
  progress: Progress
  /**
   * Which progression timeline the view derives from: `replace` starts a new
   * one. The moments resync off it (`useMoments`), because the edges a scene
   * load brings in were witnessed wherever the scene was played - not just now.
   */
  generation: number
  /** Records first witnesses reported by the sim; re-reports cost nothing. */
  witness: (keys: readonly EdgeKey[]) => void
  /**
   * Everything witnessed has now been shown, so it stops counting as new.
   * **The panel calls this as it closes**, not as it opens - see
   * `FieldNotesStore.markReviewed`.
   */
  markReviewed: () => void
  /** "Forget discoveries". The world on screen is not touched. */
  reset: () => void
  /**
   * A scene load replaces the working progression with the scene's snapshot
   * (ticket 28) - wholesale, never a merge. See `FieldNotesStore.replace`.
   */
  replace: (progress: Progress) => void
}

export interface UseFieldNotesOptions {
  /** Defaults to `localStorage`, falling back to memory where it is refused. */
  storage?: FieldNotesStorage
}

/** Private browsing modes can make even *touching* localStorage throw. */
function openStorage(): FieldNotesStorage {
  try {
    return window.localStorage
  } catch {
    // A session's discoveries still work; they just do not outlive it. Nothing
    // here is worth taking the page down for.
    return createMemoryStorage()
  }
}

/** The page's field notes. */
export function useFieldNotes(options: UseFieldNotesOptions = {}): FieldNotesController {
  // Created before the first render and never replaced, so the storage option
  // is read once - as `useScenes` does with its own store.
  const storeRef = useRef<FieldNotesStore | null>(null)
  storeRef.current ??= new FieldNotesStore(options.storage ?? openStorage())
  const store = storeRef.current

  const [progress, setProgress] = useState(() => store.progress)
  const [generation, setGeneration] = useState(0)
  const view = useMemo(() => fieldNotesView(progress), [progress])

  // The three actions are stable for the life of the page: the sim
  // subscription that feeds `witness` lives in an effect, and a new function
  // each render would tear it down and rebuild it on every witness.
  const actions = useMemo(
    () => ({
      // The store reports whether anything changed, and its snapshot keeps its
      // identity when nothing did: a re-reported first re-renders nothing.
      witness: (keys: readonly EdgeKey[]) => {
        if (store.witness(keys)) setProgress(store.progress)
      },
      markReviewed: () => {
        if (store.markReviewed()) setProgress(store.progress)
      },
      reset: () => {
        store.reset()
        setProgress(store.progress)
      },
      replace: (next: Progress) => {
        store.replace(next)
        setProgress(store.progress)
        // Batched with the progress write above, so the swapped view and the
        // new generation arrive in the same render - never a diffable gap.
        setGeneration((current) => current + 1)
      },
    }),
    [store],
  )

  // Memoized, so the controller's identity changes only when progress does.
  // The moments watch it for what has just been witnessed (`useMoments`), and a
  // fresh object every render would read as a discovery every render.
  return useMemo(
    () => ({ ...view, progress, generation, ...actions }),
    [view, progress, generation, actions],
  )
}
