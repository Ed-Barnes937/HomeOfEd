import { useCallback, useEffect, useState } from 'react'

import '../styles/tokens.scss'
import { useEngine } from '../engine/EngineContext.tsx'
import { DEFAULT_BPM, type Pattern } from '../engine/sequencerEngine.ts'
import { Grid } from '../features/grid/Grid.tsx'
import { usePlayheadMotion } from '../features/grid/usePlayheadMotion.ts'
import { TopBar } from '../features/topbar/TopBar.tsx'
import { Transport } from '../features/transport/Transport.tsx'
import { useWorkingGrid } from '../persistence/useWorkingGrid.ts'
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
  const motion = usePlayheadMotion(engine)

  // Autosave restores into the engine first; the mirror below waits for it, so
  // it reads the restored pattern and tempo rather than the empty grid.
  const restored = useWorkingGrid(engine, pattern, bpm)

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
      <TopBar />
      <Grid
        kit={engine.kit}
        pattern={pattern}
        onToggleCell={toggleCell}
        playheadStep={motion.playing ? motion.step : null}
        cellStrikes={motion.cellStrikes}
        rowStrikes={motion.rowStrikes}
      />
      <Transport
        isPlaying={isPlaying}
        onToggle={togglePlay}
        bpm={bpm}
        onTempoChange={changeTempo}
        onClearAll={clearAll}
      />
    </main>
  )
}
