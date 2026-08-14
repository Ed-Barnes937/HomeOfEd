import { useCallback, useEffect, useRef, useState } from 'react'

import '../styles/tokens.scss'
import { useEngine } from '../engine/EngineContext.tsx'
import { DEFAULT_BPM, STEPS_PER_PATTERN, type Kit, type Pattern } from '../engine/sequencerEngine.ts'
import { boopFilename } from '../export/boopFilename.ts'
import { exportBoopWav, navigatorExportTarget } from '../export/exportAction.ts'
import { DEFAULT_SAMPLE_RATE, renderBoopWav } from '../export/renderBoopWav.ts'
import { webAudioSampleDecoder } from '../export/sampleDecoder.ts'
import { BoopsPanel } from '../features/boops/BoopsPanel.tsx'
import { ClipControl } from '../features/clips/ClipControl.tsx'
import { ClipHeader } from '../features/clips/ClipHeader.tsx'
import { clipTint } from '../features/clips/clipTints.ts'
import { Grid, type GridViewProps } from '../features/grid/Grid.tsx'
import { PhoneGrid } from '../features/grid/PhoneGrid.tsx'
import { usePlayheadMotion } from '../features/grid/usePlayheadMotion.ts'
import { HintSheet } from '../features/hints/HintSheet.tsx'
import { NewBoopDialog } from '../features/presets/NewBoopDialog.tsx'
import {
  firstVisitSeed,
  PRESETS,
  presetPattern,
  type PresetId,
} from '../features/presets/presets.ts'
import { SongBar } from '../features/songbar/SongBar.tsx'
import { PhoneBar } from '../features/topbar/PhoneBar.tsx'
import { TopBar } from '../features/topbar/TopBar.tsx'
import { Transport } from '../features/transport/Transport.tsx'
import { isEditableTarget } from '../isEditableTarget.ts'
import { MAX_CLIPS, storedToPattern, WORKING_NAME, type StoredBoop } from '../persistence/saveFormat.ts'
import { useWorkingSong } from '../persistence/useWorkingSong.ts'
import { afterEdit, type LoadedBoop } from '../savedState.ts'
import { prefersShareSheet } from '../share/shareAction.ts'
import { buildShareUrl, clearShareHash, decodeShareHash } from '../share/shareLink.ts'
import {
  activeClip,
  addClip,
  deleteClip,
  renameClip,
  singleClipSong,
  songFromStored,
  storedBoopFromSong,
  togglePlacement,
  withActivePattern,
  withBpm,
  type Song,
} from '../song/song.ts'
import { useIsLaptop } from '../useIsLaptop.ts'
import { useIsPhone } from '../useIsPhone.ts'
import styles from './HomePage.module.scss'

/** An all-off pattern for `kit` — what a new or cleared clip starts as. */
function blankPattern(kit: Kit): Pattern {
  return kit.instruments.map((instrument) => ({
    instrumentId: instrument.instrumentId,
    steps: Array.from({ length: STEPS_PER_PATTERN }, () => false),
  }))
}

/**
 * The whole app: top bar, the 6x16 grid, and play/pause. The working state is
 * a *song* (ticket 14) — clips, placements, one bpm, and the active clip the
 * grid edits. The engine holds only that active clip's pattern and the tempo;
 * they are the source of truth for what sounds, mirrored into the song after
 * every edit so a toggle re-renders and the autosave sees the whole song.
 */
export function HomePage() {
  const engine = useEngine()
  const [song, setSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  // Which starter boop is currently loaded, if any — the loaded card's ring,
  // which since ticket 36 is only ever seen inside the "New boop" dialog.
  // Drops to `null` on the first change of any kind: a cell toggle, a tempo
  // move, or clear-all. Ticket 31 gave the app one definition of "changed"
  // and this follows it — the old tempo exemption is gone.
  //
  // Not restored on reload, and so deliberately not set by the first-visit
  // seed either: the ring means "you picked this, just now", and a reload of a
  // starter has never carried it.
  const [activePreset, setActivePreset] = useState<PresetId | null>(null)
  // The saved boop the grid came from, and whether it has since diverged
  // (ticket 31). `null` — a starter, a share link, a fresh or cleared grid —
  // reads "Not saved yet": none of those are rows in "My boops". Like
  // `activePreset` it is not restored on reload; the indicator describes this
  // session's loading and saving, not the autosave, which never loses anything.
  const [loaded, setLoaded] = useState<LoadedBoop | null>(null)
  // Bumped on every preset load (including blank) so the grid can stagger the
  // cells landing across columns instead of popping in all at once.
  const [loadToken, setLoadToken] = useState(0)
  // "My boops" is open or it isn't. The phone chrome's save icon (ticket 27)
  // opens the same panel: since ticket 32 the save form is always on and
  // prefilled, so "open it" *is* "get ready to save".
  const [boopsOpen, setBoopsOpen] = useState(false)
  // The starters (ticket 36) — off the main screen, behind the bottom bar's
  // "New boop" button.
  const [newBoopOpen, setNewBoopOpen] = useState(false)
  const [hintsOpen, setHintsOpen] = useState(false)
  const motion = usePlayheadMotion(engine)
  // Below the tablet layout's 1024px floor the grid would have to shrink, so
  // the pinned-rail scroll window takes over (ticket 27) — chrome and grid
  // both, since the phone's actions live in the "⋯" menu.
  const phone = useIsPhone()
  // At 1280px and up the child gets the clip-lanes design (ticket 15): clip
  // header, clip control in the well, the pinned song bar — and no transport
  // bar. The tablet band between keeps today's chrome until ticket 20.
  const laptop = useIsLaptop()

  // A shared boop is decoded on the first render, before the first restore,
  // and wins over the autosaved grid. Held in a ref so the value survives the
  // fragment being cleared below — decoding again would then find nothing.
  const sharedBoop = useRef<StoredBoop | null | undefined>(undefined)
  sharedBoop.current ??= decodeShareHash(window.location.hash)

  // The restore hands back the whole autosaved song, its active clip and tempo
  // already in the engine; adopting it here is what un-gates the render below.
  const restoredSong = useWorkingSong(engine, song, sharedBoop.current, firstVisitSeed)

  useEffect(() => {
    if (restoredSong) setSong(restoredSong)
  }, [restoredSong])

  // Tap-time reads (share, save) go through the ref so their callbacks keep a
  // stable identity while always seeing the song as it stands.
  const songRef = useRef<Song | null>(null)
  songRef.current = song

  useEffect(() => {
    if (sharedBoop.current) clearShareHash(window.location, window.history)
  }, [])

  useEffect(() => {
    if (!engine) return
    setIsPlaying(engine.isPlaying())
    return engine.onTransport((event) => {
      if (event.type === 'started') setIsPlaying(true)
      if (event.type === 'stopped') setIsPlaying(false)
      if (event.type === 'tempoChanged') setSong((s) => (s ? withBpm(s, event.bpm) : s))
    })
  }, [engine])

  /** Everything the app calls a change (ADR 0031, as amended): any mutation of the song. */
  const markEdited = useCallback(() => {
    setActivePreset(null)
    setLoaded(afterEdit)
  }, [])

  /**
   * The path a song mutation takes: apply it, and — if it really changed
   * something — mark the loaded boop edited. A refused no-op (deleting the
   * last clip, adding past the cap) is not a mutation and marks nothing.
   * Tempo is the one mutation that arrives elsewhere (the engine's
   * `tempoChanged` event above); `changeTempo` marks edited itself.
   */
  const updateSong = useCallback(
    (mutate: (song: Song) => Song): Song | null => {
      const current = songRef.current
      if (!current) return null
      const next = mutate(current)
      if (next === current) return null
      songRef.current = next
      setSong(next)
      markEdited()
      return next
    },
    [markEdited],
  )

  const toggleCell = useCallback(
    (instrumentId: string, step: number) => {
      if (!engine) return
      const row = engine.getPattern().find((r) => r.instrumentId === instrumentId)
      const on = row?.steps[step] !== true
      engine.setCell(instrumentId, step, on)
      updateSong((s) => withActivePattern(s, engine.getPattern()))
    },
    [engine, updateSong],
  )

  const loadPreset = useCallback(
    (presetId: PresetId) => {
      if (!engine) return
      const preset = PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      engine.setPattern(presetPattern(engine.kit, preset))
      engine.setTempo(preset.tempo)
      // A starter replaces the whole working slot: a fresh one-clip song.
      setSong(singleClipSong(engine.getPattern(), engine.getTempo()))
      setActivePreset(presetId)
      // A starter is never a row in "My boops", so it has no identity to
      // carry — it reads the same as a blank grid (ticket 31).
      setLoaded(null)
      setLoadToken((token) => token + 1)
      setNewBoopOpen(false)
    },
    [engine],
  )

  const togglePlay = useCallback(() => {
    if (!engine) return
    if (engine.isPlaying()) {
      engine.stop()
    } else {
      void engine.start()
    }
  }, [engine])

  // Spacebar toggles play from anywhere on the page (spec: "Transport &
  // tempo"). `preventDefault` always fires for a non-editable target, so
  // Space never scrolls the page and never re-triggers whatever button
  // happens to be focused — the boop rename field is the one exemption,
  // where Space must still type a space.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return
      event.preventDefault()
      togglePlay()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [togglePlay])

  const changeTempo = useCallback(
    (nextBpm: number) => {
      if (!engine) return
      engine.setTempo(nextBpm)
      // Tempo is part of a saved boop, so a boop whose tempo you moved really
      // does differ from the one in the list (ticket 31).
      markEdited()
    },
    [engine, markEdited],
  )

  const clearAll = useCallback(() => {
    if (!engine) return
    engine.setPattern(engine.getPattern().map((row) => ({ ...row, steps: row.steps.map(() => false) })))
    setSong((s) => (s ? withActivePattern(s, engine.getPattern()) : s))
    setActivePreset(null)
    // An empty grid is not a saved boop with things rubbed out — it is nothing,
    // and reads "Not saved yet".
    setLoaded(null)
  }, [engine])

  /** Read at tap time, so the link always carries the whole song as it stands. */
  const getShareUrl = useCallback(() => {
    if (!engine || !songRef.current) return window.location.href
    return buildShareUrl(
      window.location,
      storedBoopFromSong(engine.kit, songRef.current, WORKING_NAME),
    )
  }, [engine])

  /** Read at tap time (the Save button inside "My boops"), same reasoning as `getShareUrl`. */
  const getWorkingBoop = useCallback(
    (name: string) => {
      if (!engine || !songRef.current) throw new Error('engine not ready')
      return storedBoopFromSong(engine.kit, songRef.current, name)
    },
    [engine],
  )

  /**
   * Export one *saved* boop as a WAV (ticket 34): an offline render of that
   * row's stored pattern and tempo, then the share sheet on mobile or a
   * download on desktop. The only export path — there is no top-bar link, so
   * exporting means "export this saved boop". The double-tap guard lives on
   * the row, in `BoopsPanel`.
   */
  const exportBoop = useCallback(
    async (boop: StoredBoop) => {
      if (!engine) return
      const kit = engine.kit
      const context = new OfflineAudioContext(1, 1, DEFAULT_SAMPLE_RATE)
      const blob = await renderBoopWav({
        kit,
        pattern: storedToPattern(kit, boop.patterns[0]!),
        bpm: boop.tempo,
        decode: webAudioSampleDecoder(context),
      })
      await exportBoopWav(
        blob,
        boopFilename(boop.name),
        navigatorExportTarget(navigator, document, prefersShareSheet()),
      )
    },
    [engine],
  )

  // --- The clip-lanes handlers (ticket 15, laptop layout) ---

  /** "New boop" as a plain reset (spec §7): one blank clip, default tempo, no confirm. */
  const newBoop = useCallback(() => {
    if (!engine) return
    engine.setPattern(blankPattern(engine.kit))
    engine.setTempo(DEFAULT_BPM)
    const fresh = singleClipSong(engine.getPattern(), engine.getTempo())
    songRef.current = fresh
    setSong(fresh)
    setActivePreset(null)
    // The reset drops the loaded boop — this is a new boop, not an edit.
    setLoaded(null)
    setLoadToken((token) => token + 1)
  }, [engine])

  /** Tapping a chip puts that clip on the grid — a view change, not an edit. */
  const selectClip = useCallback(
    (index: number) => {
      if (!engine) return
      const current = songRef.current
      if (!current || index === current.activeClipIndex || !current.clips[index]) return
      const next = { ...current, activeClipIndex: index }
      engine.setPattern(activeClip(next).pattern)
      songRef.current = next
      setSong(next)
      setLoadToken((token) => token + 1)
    },
    [engine],
  )

  /** Adds a clip and puts it on the grid; `pattern` is blank or the copied clip's. */
  const addClipToSong = useCallback(
    (pattern: (song: Song) => Pattern) => {
      if (!engine) return
      const next = updateSong((s) => addClip(s, pattern(s)))
      if (!next) return
      engine.setPattern(activeClip(next).pattern)
      setLoadToken((token) => token + 1)
    },
    [engine, updateSong],
  )

  const addBlankClip = useCallback(() => {
    if (!engine) return
    const kit = engine.kit
    addClipToSong(() => blankPattern(kit))
  }, [addClipToSong, engine])

  /** "Make a copy": the active clip's pattern into a new clip, selected. */
  const copyClip = useCallback(
    () => addClipToSong((s) => activeClip(s).pattern),
    [addClipToSong],
  )

  /** "Delete clip" deletes the clip on the grid; the grid lands on a neighbour. */
  const deleteActiveClip = useCallback(() => {
    if (!engine) return
    const next = updateSong((s) => deleteClip(s, s.activeClipIndex))
    if (!next) return
    engine.setPattern(activeClip(next).pattern)
    setLoadToken((token) => token + 1)
  }, [engine, updateSong])

  const renameActiveClip = useCallback(
    (name: string) => {
      updateSong((s) => renameClip(s, s.activeClipIndex, name))
    },
    [updateSong],
  )

  const togglePlacementAt = useCallback(
    (clipIndex: number, position: number) => {
      updateSong((s) => togglePlacement(s, clipIndex, position))
    },
    [updateSong],
  )

  /**
   * "Clear grid" in the clip control is clip-scoped and an *edit* (spec §7):
   * it empties only the clip on the grid and keeps the loaded boop, unlike
   * the old transport's `clearAll` above, which the tablet and phone keep
   * until their layouts land (tickets 20/21).
   */
  const clearClip = useCallback(() => {
    if (!engine) return
    engine.setPattern(blankPattern(engine.kit))
    updateSong((s) => withActivePattern(s, engine.getPattern()))
  }, [engine, updateSong])

  const loadBoop = useCallback(
    (boop: StoredBoop, index: number) => {
      if (!engine) return
      const loadedSong = songFromStored(engine.kit, boop)
      engine.setPattern(activeClip(loadedSong).pattern)
      engine.setTempo(loadedSong.bpm)
      // The engine rounds and clamps the tempo; keep its number, as the restore does.
      setSong({ ...loadedSong, bpm: engine.getTempo() })
      setActivePreset(null)
      // The grid *is* that row now, and matches it exactly (ticket 31).
      setLoaded({ index, name: boop.name, edited: false })
      setLoadToken((token) => token + 1)
      setBoopsOpen(false)
    },
    [engine],
  )

  if (!engine || !song) {
    return (
      <main className={styles.stage}>
        <p className={styles.loading}>Loading…</p>
      </main>
    )
  }

  const gridProps: GridViewProps = {
    kit: engine.kit,
    pattern: activeClip(song).pattern,
    onToggleCell: toggleCell,
    playheadStep: motion.playing ? motion.step : null,
    cellStrikes: motion.cellStrikes,
    rowStrikes: motion.rowStrikes,
    loadToken,
  }

  return (
    // Three frame sections (ticket 33): pinned chrome, the one scrolling
    // region, pinned transport. Each carries the centring column so the bars
    // line up with the grid — the bar is inset to the column, not full-bleed
    // (ticket 37).
    <main className={styles.stage}>
      <div className={styles.chrome}>
        <div className={styles.column}>
          {phone ? (
            // The phone's actions live in the "⋯" menu: My boops / Share / How
            // boop works / Clear grid. Export is per saved boop, inside the dialog.
            <PhoneBar
              getShareUrl={getShareUrl}
              onClearGrid={clearAll}
              onSave={() => setBoopsOpen(true)}
              onOpenMyBoops={() => setBoopsOpen(true)}
              onOpenHints={() => setHintsOpen(true)}
              loaded={loaded}
            />
          ) : (
            <TopBar
              getShareUrl={getShareUrl}
              onOpenBoops={() => setBoopsOpen(true)}
              onOpenHints={() => setHintsOpen(true)}
              loaded={loaded}
              onNewBoop={laptop ? newBoop : undefined}
            />
          )}
        </div>
      </div>
      <div className={styles.scroller} data-testid="stage-scroller">
        <div className={styles.column} data-testid="stage-column">
          {/* The loop map rides inside PhoneGrid's well, so it stays glued
              under the grid inside this region rather than joining the pinned
              bar and becoming a second transport (ADR 0027). */}
          {laptop && (
            <ClipHeader
              clip={activeClip(song)}
              canDelete={song.clips.length > 1}
              canCopy={song.clips.length < MAX_CLIPS}
              onRename={renameActiveClip}
              onCopy={copyClip}
              onDelete={deleteActiveClip}
            />
          )}
          {phone ? (
            <PhoneGrid {...gridProps} />
          ) : (
            <Grid
              {...gridProps}
              tintColor={laptop ? clipTint(activeClip(song).tint) : undefined}
              wellFooter={
                laptop ? (
                  <ClipControl isPlaying={isPlaying} onToggle={togglePlay} onClearGrid={clearClip} />
                ) : undefined
              }
            />
          )}
        </div>
      </div>
      <div className={styles.transportDock}>
        <div className={styles.column}>
          {laptop ? (
            // The song bar takes the transport's pinned slot (handoff §5/§6):
            // its play became the clip control, tempo became Speed here, New
            // boop moved to the top bar, Clear grid into the clip control.
            <SongBar
              song={song}
              bpm={song.bpm}
              onTempoChange={changeTempo}
              onSelectClip={selectClip}
              onTogglePlacement={togglePlacementAt}
              onAddClip={addBlankClip}
              onToggleSong={() => {}}
              songPlaying={false}
              playingPosition={null}
            />
          ) : (
            <Transport
              isPlaying={isPlaying}
              onToggle={togglePlay}
              bpm={song.bpm}
              onTempoChange={changeTempo}
              onClearAll={clearAll}
              onNewBoop={() => setNewBoopOpen(true)}
              showClearGrid={!phone}
            />
          )}
        </div>
      </div>
      {boopsOpen && (
        <BoopsPanel
          onClose={() => setBoopsOpen(false)}
          onLoad={loadBoop}
          getWorkingBoop={getWorkingBoop}
          onExport={exportBoop}
          loaded={loaded}
          onLoadedChange={setLoaded}
        />
      )}
      {newBoopOpen && (
        <NewBoopDialog
          activePreset={activePreset}
          onSelectPreset={loadPreset}
          onClose={() => setNewBoopOpen(false)}
        />
      )}
      <HintSheet open={hintsOpen} onClose={() => setHintsOpen(false)} />
    </main>
  )
}
