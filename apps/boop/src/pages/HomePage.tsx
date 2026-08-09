import { useCallback, useEffect, useRef, useState } from 'react'

import '../styles/tokens.scss'
import { useEngine } from '../engine/EngineContext.tsx'
import { DEFAULT_BPM, type Pattern } from '../engine/sequencerEngine.ts'
import { boopFilename } from '../export/boopFilename.ts'
import { exportBoopWav, navigatorExportTarget } from '../export/exportAction.ts'
import { DEFAULT_SAMPLE_RATE, renderBoopWav } from '../export/renderBoopWav.ts'
import { webAudioSampleDecoder } from '../export/sampleDecoder.ts'
import { BoopsPanel } from '../features/boops/BoopsPanel.tsx'
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
import { PhoneBar } from '../features/topbar/PhoneBar.tsx'
import { TopBar } from '../features/topbar/TopBar.tsx'
import { Transport } from '../features/transport/Transport.tsx'
import { isEditableTarget } from '../isEditableTarget.ts'
import { storedToPattern, workingBoop, type StoredBoop } from '../persistence/saveFormat.ts'
import { useWorkingGrid } from '../persistence/useWorkingGrid.ts'
import { afterEdit, type LoadedBoop } from '../savedState.ts'
import { prefersShareSheet } from '../share/shareAction.ts'
import { buildShareUrl, clearShareHash, decodeShareHash } from '../share/shareLink.ts'
import { useIsPhone } from '../useIsPhone.ts'
import styles from './HomePage.module.scss'

/**
 * The whole app (ticket 13 — first sound): top bar, the 6x16 grid, and
 * play/pause. Grid state drives the engine's pattern directly; the engine is
 * the source of truth (`getPattern()`), mirrored into local state so toggling
 * a cell re-renders.
 */
export function HomePage() {
  const engine = useEngine()
  const [pattern, setPattern] = useState<Pattern | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [bpm, setBpm] = useState(DEFAULT_BPM)
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

  // A shared boop is decoded on the first render, before the first restore,
  // and wins over the autosaved grid. Held in a ref so the value survives the
  // fragment being cleared below — decoding again would then find nothing.
  const sharedBoop = useRef<StoredBoop | null | undefined>(undefined)
  sharedBoop.current ??= decodeShareHash(window.location.hash)

  // Autosave restores into the engine first; the mirror below waits for it, so
  // it reads the restored pattern and tempo rather than the empty grid.
  const restored = useWorkingGrid(engine, pattern, bpm, sharedBoop.current, firstVisitSeed)

  useEffect(() => {
    if (sharedBoop.current) clearShareHash(window.location, window.history)
  }, [])

  useEffect(() => {
    if (!engine || !restored) return
    setPattern(engine.getPattern())
    setIsPlaying(engine.isPlaying())
    setBpm(engine.getTempo())
    return engine.onTransport((event) => {
      if (event.type === 'started') setIsPlaying(true)
      if (event.type === 'stopped') setIsPlaying(false)
      if (event.type === 'tempoChanged') setBpm(event.bpm)
    })
  }, [engine, restored])

  /** Everything the app calls a change (ticket 31): a cell toggle and a tempo move alike. */
  const markEdited = useCallback(() => {
    setActivePreset(null)
    setLoaded(afterEdit)
  }, [])

  const toggleCell = useCallback(
    (instrumentId: string, step: number) => {
      if (!engine) return
      const row = engine.getPattern().find((r) => r.instrumentId === instrumentId)
      const on = row?.steps[step] !== true
      engine.setCell(instrumentId, step, on)
      setPattern(engine.getPattern())
      markEdited()
    },
    [engine, markEdited],
  )

  const loadPreset = useCallback(
    (presetId: PresetId) => {
      if (!engine) return
      const preset = PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      engine.setPattern(presetPattern(engine.kit, preset))
      engine.setTempo(preset.tempo)
      setPattern(engine.getPattern())
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
    setPattern(engine.getPattern())
    setActivePreset(null)
    // An empty grid is not a saved boop with things rubbed out — it is nothing,
    // and reads "Not saved yet".
    setLoaded(null)
  }, [engine])

  /** Read at tap time, so the link always carries the grid as it stands. */
  const getShareUrl = useCallback(() => {
    if (!engine) return window.location.href
    return buildShareUrl(
      window.location,
      workingBoop(engine.kit, engine.getPattern(), engine.getTempo()),
    )
  }, [engine])

  /** Read at tap time (the Save button inside "My boops"), same reasoning as `getShareUrl`. */
  const getWorkingSnapshot = useCallback(() => {
    if (!engine) throw new Error('engine not ready')
    return { kit: engine.kit, pattern: engine.getPattern(), tempo: engine.getTempo() }
  }, [engine])

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

  const loadBoop = useCallback(
    (boop: StoredBoop, index: number) => {
      if (!engine) return
      engine.setPattern(storedToPattern(engine.kit, boop.patterns[0]!))
      engine.setTempo(boop.tempo)
      setPattern(engine.getPattern())
      setActivePreset(null)
      // The grid *is* that row now, and matches it exactly (ticket 31).
      setLoaded({ index, name: boop.name, edited: false })
      setLoadToken((token) => token + 1)
      setBoopsOpen(false)
    },
    [engine],
  )

  if (!engine || !pattern) {
    return (
      <main className={styles.stage}>
        <p className={styles.loading}>Loading…</p>
      </main>
    )
  }

  const gridProps: GridViewProps = {
    kit: engine.kit,
    pattern,
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
            />
          )}
        </div>
      </div>
      <div className={styles.scroller} data-testid="stage-scroller">
        <div className={styles.column} data-testid="stage-column">
          {/* The loop map rides inside PhoneGrid's well, so it stays glued
              under the grid inside this region rather than joining the pinned
              bar and becoming a second transport (ADR 0027). */}
          {phone ? <PhoneGrid {...gridProps} /> : <Grid {...gridProps} />}
        </div>
      </div>
      <div className={styles.transportDock}>
        <div className={styles.column}>
          <Transport
            isPlaying={isPlaying}
            onToggle={togglePlay}
            bpm={bpm}
            onTempoChange={changeTempo}
            onClearAll={clearAll}
            onNewBoop={() => setNewBoopOpen(true)}
            showClearGrid={!phone}
          />
        </div>
      </div>
      {boopsOpen && (
        <BoopsPanel
          onClose={() => setBoopsOpen(false)}
          onLoad={loadBoop}
          getWorkingSnapshot={getWorkingSnapshot}
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
