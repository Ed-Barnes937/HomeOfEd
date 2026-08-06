import { useCallback, useEffect, useRef, useState } from 'react'

import '../styles/tokens.scss'
import { useEngine } from '../engine/EngineContext.tsx'
import { DEFAULT_BPM, type Pattern } from '../engine/sequencerEngine.ts'
import { Grid } from '../features/grid/Grid.tsx'
import { usePlayheadMotion } from '../features/grid/usePlayheadMotion.ts'
import { PresetRow } from '../features/presets/PresetRow.tsx'
import { PRESETS, presetPattern, type PresetId } from '../features/presets/presets.ts'
import { TopBar } from '../features/topbar/TopBar.tsx'
import { Transport } from '../features/transport/Transport.tsx'
import { workingCreation, type StoredCreation } from '../persistence/saveFormat.ts'
import { useWorkingGrid } from '../persistence/useWorkingGrid.ts'
import { buildShareUrl, clearShareHash, decodeShareHash } from '../share/shareLink.ts'
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
  // Which starter groove is currently loaded, if any — the loaded card's ring
  // (ticket 22). Drops to `null` on the first edit that isn't itself a preset
  // load: a cell toggle or clear-all. A tempo change alone does not drop it —
  // nudging the tempo of the groove you just loaded doesn't stop it being
  // that groove, and the design ties the ring's drop to "the first edit" of
  // the grid, not the transport.
  const [activePreset, setActivePreset] = useState<PresetId | null>(null)
  // Bumped on every preset load (including blank) so the grid can stagger the
  // cells landing across columns instead of popping in all at once.
  const [loadToken, setLoadToken] = useState(0)
  const motion = usePlayheadMotion(engine)

  // A shared groove is decoded on the first render, before the first restore,
  // and wins over the autosaved grid. Held in a ref so the value survives the
  // fragment being cleared below — decoding again would then find nothing.
  const sharedGroove = useRef<StoredCreation | null | undefined>(undefined)
  sharedGroove.current ??= decodeShareHash(window.location.hash)

  // Autosave restores into the engine first; the mirror below waits for it, so
  // it reads the restored pattern and tempo rather than the empty grid.
  const restored = useWorkingGrid(engine, pattern, bpm, sharedGroove.current)

  useEffect(() => {
    if (sharedGroove.current) clearShareHash(window.location, window.history)
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
      workingCreation(engine.kit, engine.getPattern(), engine.getTempo()),
    )
  }, [engine])

  if (!engine || !pattern) {
    return (
      <main className={styles.stage}>
        <p className={styles.loading}>Loading…</p>
      </main>
    )
  }

  return (
    <main className={styles.stage}>
      <TopBar getShareUrl={getShareUrl} />
      <Grid
        kit={engine.kit}
        pattern={pattern}
        onToggleCell={toggleCell}
        playheadStep={motion.playing ? motion.step : null}
        cellStrikes={motion.cellStrikes}
        rowStrikes={motion.rowStrikes}
        loadToken={loadToken}
      />
      <Transport
        isPlaying={isPlaying}
        onToggle={togglePlay}
        bpm={bpm}
        onTempoChange={changeTempo}
        onClearAll={clearAll}
      />
      <PresetRow activePreset={activePreset} onSelectPreset={loadPreset} />
    </main>
  )
}
