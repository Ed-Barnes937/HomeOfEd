import { useCallback, useEffect, useState } from 'react'

import '../styles/tokens.scss'
import { useEngine } from '../engine/EngineContext.tsx'
import type { Pattern } from '../engine/sequencerEngine.ts'
import { Grid } from '../features/grid/Grid.tsx'
import { TopBar } from '../features/topbar/TopBar.tsx'
import { Transport } from '../features/transport/Transport.tsx'
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

  useEffect(() => {
    if (!engine) return
    setPattern(engine.getPattern())
    setIsPlaying(engine.isPlaying())
    return engine.onTransport((event) => {
      if (event.type === 'started') setIsPlaying(true)
      if (event.type === 'stopped') setIsPlaying(false)
    })
  }, [engine])

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
      <Grid kit={engine.kit} pattern={pattern} onToggleCell={toggleCell} />
      <Transport isPlaying={isPlaying} onToggle={togglePlay} />
    </main>
  )
}
