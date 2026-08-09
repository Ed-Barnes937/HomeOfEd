import { useEffect, useRef, useState } from 'react'

import type { Kit, Pattern, SequencerEngine } from '../engine/sequencerEngine.ts'
import { createAutosave } from './autosave.ts'
import { storedToPattern, workingBoop, type StoredBoop } from './saveFormat.ts'
import { loadSaveDocument } from './storage.ts'

/**
 * Keeps the working grid alive across reloads: restores the autosaved boop
 * into the engine, then writes every later edit back after a lull. There is no
 * unsaved state and no save button — the tab going away flushes what's pending,
 * so the last edit is always on disk.
 *
 * Returns `true` once the autosave has been consulted. Callers must not mirror
 * engine state into React before then, or they will mirror (and re-save) the
 * empty grid the restore is about to replace.
 *
 * `openedWith` (a boop arriving from a share link) takes the autosave's place
 * as what the app opens on, and is written straight back to the autosave slot —
 * a reload after following a link keeps the boop, not the grid it replaced.
 * It must be stable across renders; it is read once, on restore.
 *
 * `seed` is what a browser that has never been here opens on (ticket 36) —
 * there is no autosave to restore, so rather than an empty grid the app starts
 * from a starter. Like a shared boop it is written straight back to the
 * autosave slot, so a reload shows the same thing rather than re-deciding.
 * A browser with a save document, however empty its grid, is never seeded.
 */
export function useWorkingGrid(
  engine: SequencerEngine | null,
  pattern: Pattern | null,
  bpm: number,
  openedWith: StoredBoop | null = null,
  seed: ((kit: Kit) => { pattern: Pattern; tempo: number }) | null = null,
): boolean {
  const autosave = useRef<ReturnType<typeof createAutosave> | null>(null)
  autosave.current ??= createAutosave(window.localStorage)
  const [restored, setRestored] = useState(false)
  /** The mirror of the just-restored grid is not an edit; don't write it back. */
  const sawFirstMirror = useRef(false)

  useEffect(() => {
    if (!engine) return
    const working = openedWith ?? loadSaveDocument(window.localStorage).working
    if (working) {
      // `working.kitId` is not checked: V1 ships one kit, and a boop from
      // another one degrades safely anyway — rows are matched by instrumentId.
      engine.setPattern(storedToPattern(engine.kit, working.patterns[0]!))
      engine.setTempo(working.tempo)
    } else if (seed) {
      const { pattern: seeded, tempo } = seed(engine.kit)
      engine.setPattern(seeded)
      engine.setTempo(tempo)
    }
    // A shared boop and a first-visit seed are both new state, not restored
    // state: let the first mirror through so the autosave slot holds it too.
    if (openedWith || (!working && seed)) sawFirstMirror.current = true
    setRestored(true)
  }, [engine, openedWith, seed])

  useEffect(() => {
    if (!engine || !pattern || !restored) return
    if (!sawFirstMirror.current) {
      sawFirstMirror.current = true
      return
    }
    autosave.current?.schedule(workingBoop(engine.kit, pattern, bpm))
  }, [engine, pattern, bpm, restored])

  useEffect(() => {
    const saver = autosave.current
    const flush = () => saver?.flush()
    // `pagehide` is the reliable one on iOS Safari; `visibilitychange` covers
    // backgrounding the tab, where a browser may kill the page without warning.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      saver?.flush()
      saver?.dispose()
    }
  }, [])

  return restored
}
