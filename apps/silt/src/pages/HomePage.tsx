import { useEffect, useMemo, useRef, useState } from 'react'

import { BRUSH_WIDTHS, buildRailPalette } from '../features/palette/paletteGroups.ts'
import { ScenesPopover } from '../features/scenes/ScenesPopover.tsx'
import { useScenes } from '../features/scenes/useScenes.ts'
import { type CursorInfo, type SimMode, useSimLoop } from '../features/sim/useSimLoop.ts'
import { type Spawner } from '../features/spawners/spawners.ts'
import { useArmedConfirm } from '../hooks/useArmedConfirm.ts'
import { EMPTY, GRID_HEIGHT, GRID_WIDTH, SAND } from '../sim/index.ts'
import styles from './HomePage.module.scss'

type Tool = 'paint' | 'erase'

/** CSS px per brush cell, for the picker's "true relative scale" icons (spec §9). */
const BRUSH_ICON_SCALE = 3

/** Marks a returning visitor — not scene data, so it stays out of the envelope (spec §8). */
const HINT_SEEN_KEY = 'silt:seen'

/** Private browsing modes can make even *touching* localStorage throw. */
function openHintStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function hasSeenHint(): boolean {
  return openHintStorage()?.getItem(HINT_SEEN_KEY) != null
}

function markHintSeen(): void {
  try {
    openHintStorage()?.setItem(HINT_SEEN_KEY, '1')
  } catch {
    // Storage failure must not break the page — the hint just won't persist
    // across reloads for this session (ticket 18).
  }
}

export function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [selectedElement, setSelectedElement] = useState<number>(SAND)
  const [tool, setTool] = useState<Tool>('paint')
  const [mode, setMode] = useState<SimMode>('paint')
  const [brushIndex, setBrushIndex] = useState(0)
  // The hint is only ever shown once, ever — persisted so a reload before the
  // first stroke doesn't bring it back (ticket 18). `hintFading` keeps it
  // mounted long enough to transition out instead of vanishing on the spot.
  const [hintVisible, setHintVisible] = useState(() => !hasSeenHint())
  const [hintFading, setHintFading] = useState(false)
  const [cursor, setCursor] = useState<CursorInfo | null>(null)
  const [fps, setFps] = useState(0)
  const [spawners, setSpawners] = useState<readonly Spawner[]>([])
  const [scenesOpen, setScenesOpen] = useState(false)
  const resetConfirm = useArmedConfirm<true>()

  const brushWidth = BRUSH_WIDTHS[brushIndex] ?? 1
  const paintSpecies = tool === 'erase' ? EMPTY : selectedElement

  // Fires once, on the first stroke (or scene load) of a first visit; a
  // returning visitor never has `hintVisible` true to begin with.
  const dismissHint = (): void => {
    if (!hintVisible || hintFading) return
    markHintSeen()
    setHintFading(true)
  }

  const controls = useSimLoop({
    canvasRef,
    running,
    selectedElement: paintSpecies,
    brushWidth,
    mode,
    onPaint: dismissHint,
    onCursorChange: setCursor,
    onFps: setFps,
    onSpawnersChange: setSpawners,
  })

  // Derived from the same registry the canvas paints from — never from
  // `v1Elements` directly — so the rail can't drift from the grid (ticket 16).
  const palette = useMemo(() => buildRailPalette(controls.registry), [controls.registry])

  const scenes = useScenes({
    saveScene: controls.saveScene,
    loadScene: controls.loadScene,
    // A load always enters paused (spec §8), and the world it brought in is
    // not a first visit any more. The name is the controller's — it names the
    // scene a save would write to, whoever last changed it.
    onLoaded: () => {
      setRunning(false)
      dismissHint()
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
  const paletteRef = useRef(palette)
  paletteRef.current = palette

  const armReset = (): void => {
    if (!resetConfirm.armed) {
      resetConfirm.arm(true)
      return
    }
    resetConfirm.disarm()
    controls.reset()
    // An empty world is not the scene that was loaded, and saving is not the
    // moment to find that out: the next save makes a new scene instead.
    scenes.clearCurrentScene()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // The scene rename field is a text input: the hotkeys would eat what is
      // being typed into it — Ctrl+S included, which would save the world on
      // screen over the scene being renamed.
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setScenesOpen(true)
        saveSceneRef.current()
        return
      }
      if (event.key === 'Escape') {
        setScenesOpen(false)
        return
      }
      if (event.key >= '1' && event.key <= '9') {
        const entry = paletteRef.current.entries[Number(event.key) - 1]
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

  const selectedName = tool === 'erase' ? 'erase' : palette.nameOf(selectedElement)

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
            {scenes.currentName ?? 'untitled'}
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
            className={`${styles.headerButton} ${resetConfirm.armed ? styles.armed : ''}`}
            data-testid="reset"
            onClick={armReset}
          >
            {resetConfirm.armed ? 'confirm?' : 'reset'}
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
              onDuplicate={scenes.duplicate}
              onDelete={scenes.delete}
              onClose={() => setScenesOpen(false)}
            />
          ) : null}
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.rail} aria-label="tools">
          <div className={styles.palette} data-testid="palette">
            {palette.groups.map((group) => (
              <div key={group.label} className={styles.paletteGroup}>
                <span className={styles.groupLabel}>{group.label}</span>
                {group.entries.map((entry) => {
                  const hotkey = palette.entries.indexOf(entry) + 1
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

            {hintVisible ? (
              <div
                className={`${styles.firstVisitHint} ${hintFading ? styles.firstVisitHintFading : ''}`}
                data-testid="first-visit-hint"
                onTransitionEnd={() => setHintVisible(false)}
              >
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
              const colour = palette.colourOf(spawner.element)
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
                  background: palette.colourOf(selectedElement),
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
