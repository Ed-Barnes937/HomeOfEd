import { useRef } from 'react'

import { DEFAULT_PARAMS } from '../features/sim/engine/params.ts'
import { neonTheme } from '../features/sim/themes.ts'
import { useSimulationLoop } from '../features/sim/useSimulationLoop.ts'
import styles from './BoidsPage.module.scss'

export function BoidsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Theme/shape picking and persisted params land in B4/B5 — fixed neon
  // defaults for now, per the B3 scope (canvas + loop).
  useSimulationLoop({
    canvasRef,
    theme: neonTheme,
    shape: 'triangle',
    params: DEFAULT_PARAMS,
  })

  return <canvas ref={canvasRef} data-testid="boids-page" className={styles.canvas} />
}
