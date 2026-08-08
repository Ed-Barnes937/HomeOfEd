import { useCallback, useEffect, useRef, useState } from 'react'

import '../styles/tokens.scss'
import { useEngine } from '../engine/EngineContext.tsx'
import { DEFAULT_BPM, type Pattern } from '../engine/sequencerEngine.ts'
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
  // The "My boops" panel is closed, opened for browsing, or opened straight
  // into its just-saved state — the phone chrome's save icon (ticket 27) has no
  // room for a "Saved it" moment of its own, so it borrows the panel's.
  const [boopsPanel, setBoopsPanel] = useState<'closed' | 'open' | 'saving'>('closed')
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
   * The demoted "Save the sound as a file" link under Share (ticket 25): an
   * offline render of the pattern to WAV, then the share sheet on mobile or
   * a download on desktop. `exporting` guards against a double-tap kicking
   * off a second render while the first is still decoding.
   */
  const exporting = useRef(false)
  const exportWav = useCallback(() => {
    if (!engine || exporting.current) return
    exporting.current = true
    const kit = engine.kit
    const pattern = engine.getPattern()
    const bpm = engine.getTempo()
    void (async () => {
      try {
        const context = new OfflineAudioContext(1, 1, DEFAULT_SAMPLE_RATE)
        const blob = await renderBoopWav({ kit, pattern, bpm, decode: webAudioSampleDecoder(context) })
        await exportBoopWav(
          blob,
          'boop.wav',
          navigatorExportTarget(navigator, document, prefersShareSheet()),
        )
      } finally {
        exporting.current = false
      }
    })()
  }, [engine])

  const loadBoop = useCallback(
    (boop: StoredBoop) => {
      if (!engine) return
      engine.setPattern(storedToPattern(engine.kit, boop.patterns[0]!))
      engine.setTempo(boop.tempo)
      setPattern(engine.getPattern())
      setActivePreset(null)
      setLoadToken((token) => token + 1)
      setBoopsPanel('closed')
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
    <main className={styles.stage}>
      <div className={styles.column} data-testid="stage-column">
        {phone ? (
          // The phone chrome has no room for the export link (ticket 25) — its
          // "⋯" menu is My boops / Share / How boop works / Clear grid.
          <PhoneBar
            getShareUrl={getShareUrl}
            onClearGrid={clearAll}
            onSave={() => setBoopsPanel('saving')}
            onOpenMyBoops={() => setBoopsPanel('open')}
            onOpenHints={() => setHintsOpen(true)}
          />
        ) : (
          <TopBar
            getShareUrl={getShareUrl}
            onOpenBoops={() => setBoopsPanel('open')}
            onOpenHints={() => setHintsOpen(true)}
            onExportWav={exportWav}
          />
        )}
        {phone ? <PhoneGrid {...gridProps} /> : <Grid {...gridProps} />}
        <Transport
          isPlaying={isPlaying}
          onToggle={togglePlay}
          bpm={bpm}
          onTempoChange={changeTempo}
          onClearAll={clearAll}
          showClearGrid={!phone}
        />
        <PresetRow activePreset={activePreset} onSelectPreset={loadPreset} />
      </div>
      {boopsPanel !== 'closed' && (
        <BoopsPanel
          onClose={() => setBoopsPanel('closed')}
          onLoad={loadBoop}
          getWorkingSnapshot={getWorkingSnapshot}
          saveOnOpen={boopsPanel === 'saving'}
        />
      )}
      <HintSheet open={hintsOpen} onClose={() => setHintsOpen(false)} />
    </main>
  )
}
