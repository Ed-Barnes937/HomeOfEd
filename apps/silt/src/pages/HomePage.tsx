import { useEffect, useRef, useState } from 'react'

import { BRUSH_WIDTHS, paletteEntries, paletteGroups } from '../features/palette/paletteGroups.ts'
import { ScenesPopover } from '../features/scenes/ScenesPopover.tsx'
import { useScenes } from '../features/scenes/useScenes.ts'
import { type CursorInfo, type SimMode, useSimLoop } from '../features/sim/useSimLoop.ts'
import { type Spawner } from '../features/spawners/spawners.ts'
import { EMPTY, GRID_HEIGHT, GRID_WIDTH, SAND } from '../sim/index.ts'
import styles from './HomePage.module.scss'

type Tool = 'paint' | 'erase'

/** How long a reset click stays armed before it forgets the first click (spec §3, §9). */
const RESET_ARM_MS = 3000

/** CSS px per brush cell, for the picker's "true relative scale" icons (spec §9). */
const BRUSH_ICON_SCALE = 3

export function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [selectedElement, setSelectedElement] = useState<number>(SAND)
  const [tool, setTool] = useState<Tool>('paint')
  const [mode, setMode] = useState<SimMode>('paint')
  const [brushIndex, setBrushIndex] = useState(0)
  const [hasPainted, setHasPainted] = useState(false)
  const [resetArmed, setResetArmed] = useState(false)
  const [cursor, setCursor] = useState<CursorInfo | null>(null)
  const [fps, setFps] = useState(0)
  const [spawners, setSpawners] = useState<readonly Spawner[]>([])
  const [scenesOpen, setScenesOpen] = useState(false)
  const [sceneName, setSceneName] = useState('untitled')
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const brushWidth = BRUSH_WIDTHS[brushIndex] ?? 1
  const paintSpecies = tool === 'erase' ? EMPTY : selectedElement

  const controls = useSimLoop({
    canvasRef,
    running,
    selectedElement: paintSpecies,
    brushWidth,
    mode,
    onPaint: () => setHasPainted(true),
    onCursorChange: setCursor,
    onFps: setFps,
    onSpawnersChange: setSpawners,
  })

  const scenes = useScenes({
    saveScene: controls.saveScene,
    loadScene: controls.loadScene,
    // A load always enters paused (spec §8), and the world it brought in is
    // not a first visit any more.
    onLoaded: (name) => {
      setRunning(false)
      setSceneName(name)
      setHasPainted(true)
      setScenesOpen(false)
    },
  })

  // Latest-value refs so the keydown listener below can be registered once
  // (with an empty dependency array) instead of re-binding on every render.
  const runningRef = useRef(running)
  runningRef.current = running
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const saveSceneRef = useRef(scenes.save)
  saveSceneRef.current = scenes.save

  const armReset = (): void => {
    if (!resetArmed) {
      setResetArmed(true)
      resetTimer.current = setTimeout(() => setResetArmed(false), RESET_ARM_MS)
      return
    }
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setResetArmed(false)
    controls.reset()
  }

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setScenesOpen(true)
        saveSceneRef.current()
        return
      }
      // The scene rename field is a text input: single-key tools would eat
      // what is being typed into it.
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'Escape') {
        setScenesOpen(false)
        return
      }
      if (event.key >= '1' && event.key <= '9') {
        const entry = paletteEntries[Number(event.key) - 1]
        if (entry) {
          setTool('paint')
          setSelectedElement(entry.id)
        }
        return
      }
      if (event.key === '[') {
        setBrushIndex((current) => Math.max(0, current - 1))
        return
      }
      if (event.key === ']') {
        setBrushIndex((current) => Math.min(BRUSH_WIDTHS.length - 1, current + 1))
        return
      }
      if (event.key === ' ') {
        event.preventDefault()
        setRunning((current) => !current)
        return
      }
      if (event.key === '.') {
        if (!runningRef.current) controlsRef.current.step()
        return
      }
      if (event.key === 'e' || event.key === 'E') {
        setTool('erase')
        setMode('paint')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectElement = (id: number): void => {
    setTool('paint')
    setSelectedElement(id)
  }

  const selectedName = tool === 'erase' ? 'erase' : (paletteEntries.find((e) => e.id === selectedElement)?.name ?? '')

  // The hovered cell, in spawner mode, may already hold a spawner — that one
  // renders red-with-minus instead of the placement ghost (spec §7, §9).
  const hoveredSpawnerIndex =
    mode === 'spawner' && cursor
      ? spawners.findIndex((spawner) => spawner.x === cursor.cell.x && spawner.y === cursor.cell.y)
      : -1

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>SILT</span>
          <span className={styles.sceneName} data-testid="scene-name">
            {sceneName}
          </span>
        </div>
        <div className={styles.headerControls}>
          <button
            type="button"
            className={styles.headerButton}
            data-testid="play-toggle"
            onClick={() => setRunning((current) => !current)}
          >
            {running ? 'pause' : 'play'}
          </button>
          <button
            type="button"
            className={`${styles.headerButton} ${styles.stepButton}`}
            data-testid="step"
            disabled={running}
            onClick={() => controls.step()}
          >
            step
          </button>
          <button
            type="button"
            className={`${styles.headerButton} ${resetArmed ? styles.armed : ''}`}
            data-testid="reset"
            onClick={armReset}
          >
            {resetArmed ? 'confirm?' : 'reset'}
          </button>
        </div>
        <div className={styles.scenesAnchor}>
          <button
            type="button"
            className={styles.headerButton}
            data-testid="scenes-button"
            aria-expanded={scenesOpen}
            onClick={() => setScenesOpen((open) => !open)}
          >
            scenes
          </button>
          {scenesOpen ? (
            <ScenesPopover
              scenes={scenes.scenes}
              status={scenes.status}
              onSave={scenes.save}
              onLoad={scenes.load}
              onRename={scenes.rename}
              onDelete={scenes.remove}
              onClose={() => setScenesOpen(false)}
            />
          ) : null}
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.rail} aria-label="tools">
          <div className={styles.palette} data-testid="palette">
            {paletteGroups.map((group) => (
              <div key={group.label} className={styles.paletteGroup}>
                <span className={styles.groupLabel}>{group.label}</span>
                {group.entries.map((entry) => {
                  const hotkey = paletteEntries.indexOf(entry) + 1
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={styles.swatchRow}
                      data-testid={`element-${entry.name}`}
                      aria-pressed={tool === 'paint' && selectedElement === entry.id}
                      onClick={() => selectElement(entry.id)}
                    >
                      <span
                        className={styles.swatch}
                        style={{ background: entry.colour }}
                        aria-hidden="true"
                      />
                      <span className={styles.swatchName}>{entry.name}</span>
                      <span className={styles.hotkey}>{hotkey}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className={styles.section}>
            <span className={styles.groupLabel}>Brush</span>
            <div className={styles.brushRow} data-testid="brush-picker">
              {BRUSH_WIDTHS.map((width, index) => (
                <button
                  key={width}
                  type="button"
                  className={styles.brushButton}
                  data-testid={`brush-${index}`}
                  aria-pressed={brushIndex === index}
                  onClick={() => setBrushIndex(index)}
                >
                  <span
                    className={styles.brushSquare}
                    // True relative scale (spec §9): each icon's side is proportional
                    // to the brush's actual cell width, not just its position in the list.
                    style={{ width: width * BRUSH_ICON_SCALE, height: width * BRUSH_ICON_SCALE }}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.groupLabel}>Mode</span>
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={styles.modeButton}
                data-testid="mode-paint"
                aria-pressed={mode === 'paint'}
                onClick={() => setMode('paint')}
              >
                paint
              </button>
              <button
                type="button"
                className={styles.modeButton}
                data-testid="mode-spawner"
                aria-pressed={mode === 'spawner'}
                onClick={() => {
                  // Erase has no element to spawn — leaving it active would
                  // let a spawner get placed with EMPTY (spec §7 entities
                  // always carry a real element).
                  setTool('paint')
                  setMode('spawner')
                }}
              >
                spawner
              </button>
            </div>
          </div>

          <button
            type="button"
            className={styles.eraseButton}
            data-testid="erase-tool"
            aria-pressed={tool === 'erase'}
            onClick={() => {
              setTool('erase')
              setMode('paint')
            }}
          >
            erase
          </button>
        </nav>

        <div className={styles.stage}>
          <div className={`${styles.canvasWrap} ${!running ? styles.paused : ''}`}>
            <canvas ref={canvasRef} className={styles.canvas} data-testid="silt-canvas" />

            <div
              className={`${styles.runPill} ${running ? styles.running : styles.pillPaused}`}
              data-testid="run-pill"
            >
              {running ? <span className={styles.blinkDot} aria-hidden="true" /> : null}
              {running ? 'running' : 'paused'}
            </div>

            {!hasPainted ? (
              <div className={styles.firstVisitHint} data-testid="first-visit-hint">
                drag to pour sand
              </div>
            ) : null}

            {cursor && mode === 'paint' ? (
              <div
                className={styles.brushCursor}
                style={{
                  left: cursor.point.x,
                  top: cursor.point.y,
                  width: cursor.cellSize * brushWidth,
                  height: cursor.cellSize * brushWidth,
                }}
                aria-hidden="true"
              />
            ) : null}

            {spawners.map((spawner, index) => {
              const point = controls.gridToCanvasPoint(spawner.x, spawner.y)
              if (!point) return null
              const size = controls.cellSize()
              const removing = index === hoveredSpawnerIndex
              const colour = paletteEntries.find((entry) => entry.id === spawner.element)?.colour
              return (
                <div
                  key={`${spawner.x}-${spawner.y}`}
                  className={`${styles.spawner} ${removing ? styles.spawnerRemove : ''}`}
                  style={{
                    left: point.x,
                    top: point.y,
                    width: size,
                    height: size,
                    background: removing ? undefined : colour,
                  }}
                  data-testid={`spawner-${spawner.x}-${spawner.y}`}
                  aria-hidden="true"
                >
                  {removing ? <span className={styles.spawnerMinus} aria-hidden="true" /> : null}
                </div>
              )
            })}

            {mode === 'spawner' && cursor && hoveredSpawnerIndex === -1 ? (
              <div
                className={styles.spawnerGhost}
                style={{
                  left: cursor.point.x,
                  top: cursor.point.y,
                  width: cursor.cellSize,
                  height: cursor.cellSize,
                  background: paletteEntries.find((entry) => entry.id === selectedElement)?.colour,
                }}
                data-testid="spawner-ghost"
                aria-hidden="true"
              />
            ) : null}
          </div>

          <div className={styles.statusBar} data-testid="status-bar">
            <div className={styles.statusLeft}>
              <span data-testid="status-element">{selectedName}</span>
              <span data-testid="status-brush">
                brush {brushWidth}×{brushWidth}
              </span>
              <span data-testid="status-spawners">spawners {spawners.length}</span>
              <span data-testid="status-mode">{mode}</span>
            </div>
            <div className={styles.statusRight}>
              <span data-testid="status-cursor">{cursor ? `${cursor.cell.x},${cursor.cell.y}` : '–'}</span>
              <span data-testid="status-grid-size">
                {GRID_WIDTH}×{GRID_HEIGHT}
              </span>
              <span data-testid="status-fps">{fps} fps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
