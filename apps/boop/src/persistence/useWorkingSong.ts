import { useEffect, useRef, useState } from 'react'

import type { Kit, Pattern, SequencerEngine } from '../engine/sequencerEngine.ts'
import { activeClip, singleClipSong, songFromStored, storedBoopFromSong, type Song } from '../song/song.ts'
import { createAutosave } from './autosave.ts'
import { WORKING_NAME, type StoredBoop } from './saveFormat.ts'
import { loadSaveDocument } from './storage.ts'

/**
 * Keeps the working song alive across reloads (ticket 14): restores the
 * autosaved boop — the whole song, whose active clip and tempo go into the
 * engine — then writes every later edit back after a lull. There is no
 * unsaved state and no save button — the tab going away flushes what's
 * pending, so the last edit is always on disk.
 *
 * Returns the restored song once the autosave has been consulted, `null`
 * until then. The caller adopts it as its working state and passes that state
 * back in as `song`; every change to it after the first is scheduled into the
 * autosave. Callers must not build their own state before the restore lands,
 * or they would mirror (and re-save) the empty grid it is about to replace.
 *
 * `openedWith` (a boop arriving from a share link) takes the autosave's place
 * as what the app opens on, and is written straight back to the autosave slot —
 * a reload after following a link keeps the boop, not the song it replaced.
 * It must be stable across renders; it is read once, on restore.
 *
 * `seed` is what a browser that has never been here opens on (ticket 36) —
 * there is no autosave to restore, so rather than an empty grid the app starts
 * from a one-clip song. Like a shared boop it is written straight back to the
 * autosave slot, so a reload shows the same thing rather than re-deciding.
 * "Never been here" means no *working song* — `working: null`, which is what a
 * fresh browser reads as. A browser with saved boops but no working song is
 * seeded too, and rightly: the seed replaces nothing.
 */
export function useWorkingSong(
  engine: SequencerEngine | null,
  song: Song | null,
  openedWith: StoredBoop | null = null,
  seed: ((kit: Kit) => { pattern: Pattern; tempo: number }) | null = null,
): Song | null {
  const autosave = useRef<ReturnType<typeof createAutosave> | null>(null)
  autosave.current ??= createAutosave(window.localStorage)
  const [restored, setRestored] = useState<Song | null>(null)
  /** The mirror of the just-restored song is not an edit; don't write it back. */
  const sawFirstMirror = useRef(false)

  useEffect(() => {
    if (!engine) return
    const working = openedWith ?? loadSaveDocument(window.localStorage).working
    let initial: Song
    if (working) {
      // `working.kitId` is not checked: V1 ships one kit, and a boop from
      // another one degrades safely anyway — rows are matched by instrumentId.
      initial = songFromStored(engine.kit, working)
      // A shared boop is new state, not restored state: let the first mirror
      // through so the autosave slot holds it too.
      if (openedWith) sawFirstMirror.current = true
    } else if (seed) {
      const { pattern: seeded, tempo } = seed(engine.kit)
      initial = singleClipSong(seeded, tempo)
      // Same reasoning — a seeded first visit is written straight back, so a
      // reload shows it rather than re-deciding.
      sawFirstMirror.current = true
    } else {
      initial = singleClipSong(engine.getPattern(), engine.getTempo())
    }
    engine.setPattern(activeClip(initial).pattern)
    engine.setTempo(initial.bpm)
    // The engine rounds and clamps the tempo; the song keeps the engine's
    // number so the two never disagree by a fraction.
    setRestored({ ...initial, bpm: engine.getTempo() })
  }, [engine, openedWith, seed])

  useEffect(() => {
    if (!engine || !song) return
    if (!sawFirstMirror.current) {
      sawFirstMirror.current = true
      return
    }
    autosave.current?.schedule(storedBoopFromSong(engine.kit, song, WORKING_NAME))
  }, [engine, song])

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
