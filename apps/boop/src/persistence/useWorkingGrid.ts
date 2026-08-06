import { useEffect, useRef, useState } from 'react'

import type { Pattern, SequencerEngine } from '../engine/sequencerEngine.ts'
import { createAutosave } from './autosave.ts'
import { patternToStored, storedToPattern } from './saveFormat.ts'
import { loadSaveDocument } from './storage.ts'

/** The working grid is unnamed until a child saves it into "My grooves". */
const WORKING_NAME = ''

/**
 * Keeps the working grid alive across reloads: restores the autosaved creation
 * into the engine, then writes every later edit back after a lull. There is no
 * unsaved state and no save button — the tab going away flushes what's pending,
 * so the last edit is always on disk.
 *
 * Returns `true` once the autosave has been consulted. Callers must not mirror
 * engine state into React before then, or they will mirror (and re-save) the
 * empty grid the restore is about to replace.
 */
export function useWorkingGrid(
  engine: SequencerEngine | null,
  pattern: Pattern | null,
  bpm: number,
): boolean {
  const autosave = useRef<ReturnType<typeof createAutosave> | null>(null)
  autosave.current ??= createAutosave(window.localStorage)
  const [restored, setRestored] = useState(false)
  /** The mirror of the just-restored grid is not an edit; don't write it back. */
  const sawFirstMirror = useRef(false)

  useEffect(() => {
    if (!engine) return
    const working = loadSaveDocument(window.localStorage).working
    if (working) {
      // `working.kitId` is not checked: V1 ships one kit, and a creation from
      // another one degrades safely anyway — rows are matched by instrumentId.
      engine.setPattern(storedToPattern(engine.kit, working.patterns[0]!))
      engine.setTempo(working.tempo)
    }
    setRestored(true)
  }, [engine])

  useEffect(() => {
    if (!engine || !pattern || !restored) return
    if (!sawFirstMirror.current) {
      sawFirstMirror.current = true
      return
    }
    autosave.current?.schedule({
      name: WORKING_NAME,
      kitId: engine.kit.kitId,
      tempo: bpm,
      patterns: [patternToStored(pattern)],
    })
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
