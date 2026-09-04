import { type CSSProperties, useEffect, useRef, useState } from 'react'

import { ControlPanel } from '../features/controls/ControlPanel.tsx'
import { CursorGlyph, type CursorGlyphVariant } from '../features/controls/CursorGlyph.tsx'
import type { SimParams } from '../features/sim/engine/params.ts'
import type { BoidShape } from '../features/sim/render/renderer.ts'
import { CURSOR_RADIUS } from '../features/sim/engine/simulation.ts'
import { loadSettings, saveSettings, type CursorIcon, type ThemeId } from '../features/sim/settings.ts'
import { prefersReducedMotion, REDUCED_MOTION_QUERY } from '../features/sim/reducedMotion.ts'
import { getTheme, THEMES } from '../features/sim/themes.ts'
import { useSimulationLoop } from '../features/sim/useSimulationLoop.ts'
import { hubUrl } from '../hubUrl.ts'
import styles from './BoidsPage.module.scss'

/** null = draw no glyph (icon off, or no active force so 'creatures' has no sign). */
function glyphVariant(icon: CursorIcon, cursor: number): CursorGlyphVariant | null {
  if (icon === 'off' || cursor === 0) return null
  if (icon === 'ring') return 'ring'
  return cursor > 0 ? 'berry' : 'cat'
}

export function BoidsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [settings, setSettings] = useState(() => loadSettings(window.localStorage))
  // Session state, deliberately not in `settings`: a pause is about this sitting,
  // not a preference to restore, and the initial value comes from the
  // reduced-motion query rather than from storage (ADR 0044).
  const [running, setRunning] = useState(() => !prefersReducedMotion())
  // Whether the *current* pause is the device's doing rather than the user's -
  // the only case that needs explaining. Cleared the moment they touch the
  // control, because from then on the state is theirs.
  const [pausedByDevice, setPausedByDevice] = useState(() => prefersReducedMotion())

  // A mid-session switch to less motion pauses the flock. Only the change event
  // does this, so nothing here can re-pause someone who already pressed play;
  // switching the setting back off leaves them paused rather than starting
  // motion they did not ask for.
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = (event: MediaQueryListEvent): void => {
      if (!event.matches) return
      setRunning(false)
      setPausedByDevice(true)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  function handleRunningChange(next: boolean): void {
    setRunning(next)
    setPausedByDevice(false)
  }

  useSimulationLoop({
    canvasRef,
    overlayRef,
    theme: getTheme(settings.theme),
    shape: settings.shape,
    params: settings.params,
    running,
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

  function handleCursorIconChange(cursorIcon: CursorIcon): void {
    persist({ ...settings, cursorIcon })
  }

  function handleParamsChange(params: SimParams): void {
    persist({ ...settings, params })
  }

  const cursor = settings.params.cursor
  const variant = glyphVariant(settings.cursorIcon, cursor)

  return (
    <>
      <a
        className={styles.back}
        href={hubUrl(window.location.hostname)}
        aria-label="Back to home of ed"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      </a>
      <canvas
        ref={canvasRef}
        data-testid="boids-page"
        className={styles.canvas}
        data-hide-cursor={variant ? 'true' : 'false'}
      />
      {/* Field + glyph, moved as a unit by useSimulationLoop (transform on this
          node); children self-centre. --cursor-radius feeds the field size from
          the engine constant so the ring matches the physics exactly. */}
      <div
        ref={overlayRef}
        className={styles.cursorOverlay}
        data-testid="cursor-overlay"
        data-active="false"
        aria-hidden="true"
        style={{ '--cursor-radius': `${CURSOR_RADIUS}px` } as CSSProperties}
      >
        {cursor !== 0 && (
          <div
            className={styles.cursorField}
            data-testid="cursor-field"
            data-sign={cursor > 0 ? 'attract' : 'repel'}
          />
        )}
        {variant && (
          <CursorGlyph
            className={styles.cursorGlyph}
            variant={variant}
            data-testid="cursor-glyph"
            data-variant={variant}
          />
        )}
      </div>
      <ControlPanel
        running={running}
        onRunningChange={handleRunningChange}
        pausedByDevice={pausedByDevice}
        theme={settings.theme}
        onThemeChange={handleThemeChange}
        shape={settings.shape}
        onShapeChange={handleShapeChange}
        cursorIcon={settings.cursorIcon}
        onCursorIconChange={handleCursorIconChange}
        params={settings.params}
        onParamsChange={handleParamsChange}
      />
    </>
  )
}
