import { useRef, useState } from 'react'

import { ControlPanel } from '../features/controls/ControlPanel.tsx'
import type { SimParams } from '../features/sim/engine/params.ts'
import { loadSettings, saveSettings } from '../features/sim/settings.ts'
import { neonTheme } from '../features/sim/themes.ts'
import { useSimulationLoop } from '../features/sim/useSimulationLoop.ts'
import styles from './BoidsPage.module.scss'

export function BoidsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [settings, setSettings] = useState(() => loadSettings(window.localStorage))

  // Theme picking (ThemePicker/ShapePicker, data-theme wiring) lands in B5 —
  // neonTheme is fixed for now; settings.shape/theme are already persisted
  // even though there's no control for them yet.
  useSimulationLoop({
    canvasRef,
    theme: neonTheme,
    shape: settings.shape,
    params: settings.params,
  })

  function handleParamsChange(params: SimParams): void {
    setSettings((prev) => {
      const next = { ...prev, params }
      saveSettings(next, window.localStorage)
      return next
    })
  }

  return (
    <>
      <canvas ref={canvasRef} data-testid="boids-page" className={styles.canvas} />
      <ControlPanel params={settings.params} onParamsChange={handleParamsChange} />
    </>
  )
}
