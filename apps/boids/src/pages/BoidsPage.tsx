import { useEffect, useRef, useState } from 'react'

import { ControlPanel } from '../features/controls/ControlPanel.tsx'
import type { SimParams } from '../features/sim/engine/params.ts'
import type { BoidShape } from '../features/sim/render/renderer.ts'
import { loadSettings, saveSettings, type ThemeId } from '../features/sim/settings.ts'
import { getTheme, THEMES } from '../features/sim/themes.ts'
import { useSimulationLoop } from '../features/sim/useSimulationLoop.ts'
import styles from './BoidsPage.module.scss'

export function BoidsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [settings, setSettings] = useState(() => loadSettings(window.localStorage))

  useSimulationLoop({
    canvasRef,
    theme: getTheme(settings.theme),
    shape: settings.shape,
    params: settings.params,
  })

  // Theme swap sets data-theme on <html>, which flips every CSS token
  // (panel/controls); the canvas palette follows via getTheme() above.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  function persist(next: typeof settings): void {
    setSettings(next)
    saveSettings(next, window.localStorage)
  }

  // Themes with a signature shape (space→rocket, duck season→duck) switch to it
  // on selection; the shape picker can still override afterwards.
  function handleThemeChange(theme: ThemeId): void {
    const shape = THEMES[theme].shape
    persist({ ...settings, theme, ...(shape ? { shape } : {}) })
  }

  function handleShapeChange(shape: BoidShape): void {
    persist({ ...settings, shape })
  }

  function handleParamsChange(params: SimParams): void {
    persist({ ...settings, params })
  }

  return (
    <>
      <canvas ref={canvasRef} data-testid="boids-page" className={styles.canvas} />
      <ControlPanel
        theme={settings.theme}
        onThemeChange={handleThemeChange}
        shape={settings.shape}
        onShapeChange={handleShapeChange}
        params={settings.params}
        onParamsChange={handleParamsChange}
      />
    </>
  )
}
