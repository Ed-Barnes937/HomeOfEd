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
import { PresetRow } from '../features/presets/PresetRow.tsx'
import { PRESETS, presetPattern, type PresetId } from '../features/presets/presets.ts'
import { PhoneBar } from '../features/topbar/PhoneBar.tsx'
import { TopBar } from '../features/topbar/TopBar.tsx'
import { Transport } from '../features/transport/Transport.tsx'
import { isEditableTarget } from '../isEditableTarget.ts'
import { storedToPattern, workingBoop, type StoredBoop } from '../persistence/saveFormat.ts'
import { useWorkingGrid } from '../persistence/useWorkingGrid.ts'
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
  // Which starter boop is currently loaded, if any — the loaded card's ring
  // (ticket 22). Drops to `null` on the first edit that isn't itself a preset
  // load: a cell toggle or clear-all. A tempo change alone does not drop it —
  // nudging the tempo of the boop you just loaded doesn't stop it being
  // that boop, and the design ties the ring's drop to "the first edit" of
  // the grid, not the transport.
  const [activePreset, setActivePreset] = useState<PresetId | null>(null)
  // Bumped on every preset load (including blank) so the grid can stagger the
  // cells landing across columns instead of popping in all at once.
  const [loadToken, setLoadToken] = useState(0)
  // "My boops" is open or it isn't. The phone chrome's save icon (ticket 27)
  // opens the same panel: since ticket 32 the save form is always on and
  // prefilled, so "open it" *is* "get ready to save".
  const [boopsOpen, setBoopsOpen] = useState(false)
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
  const restored = useWorkingGrid(engine, pattern, bpm, sharedBoop.current)

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

  const toggleCell = useCallback(
    (instrumentId: string, step: number) => {
      if (!engine) return
      const row = engine.getPattern().find((r) => r.instrumentId === instrumentId)
      const on = row?.steps[step] !== true
      engine.setCell(instrumentId, step, on)
      setPattern(engine.getPattern())
      setActivePreset(null)
    },
    [engine],
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
      setLoadToken((token) => token + 1)
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
    },
    [engine],
  )

  const clearAll = useCallback(() => {
    if (!engine) return
    engine.setPattern(engine.getPattern().map((row) => ({ ...row, steps: row.steps.map(() => false) })))
    setPattern(engine.getPattern())
    setActivePreset(null)
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
    (boop: StoredBoop) => {
      if (!engine) return
      engine.setPattern(storedToPattern(engine.kit, boop.patterns[0]!))
      engine.setTempo(boop.tempo)
      setPattern(engine.getPattern())
      setActivePreset(null)
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
            />
          ) : (
            <TopBar
              getShareUrl={getShareUrl}
              onOpenBoops={() => setBoopsOpen(true)}
              onOpenHints={() => setHintsOpen(true)}
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
          <PresetRow activePreset={activePreset} onSelectPreset={loadPreset} />
        </div>
      </div>
      <div className={styles.bars}>
        <div className={styles.column}>
          <Transport
            isPlaying={isPlaying}
            onToggle={togglePlay}
            bpm={bpm}
            onTempoChange={changeTempo}
            onClearAll={clearAll}
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
        />
      )}
      <HintSheet open={hintsOpen} onClose={() => setHintsOpen(false)} />
    </main>
  )
}
