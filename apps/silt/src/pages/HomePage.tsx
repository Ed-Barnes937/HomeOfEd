import { useMemo, useRef, useState } from 'react'

import { BRUSH_WIDTHS, buildRailPalette } from '../features/palette/paletteGroups.ts'
import { WorldOverlay } from '../features/render/WorldOverlay.tsx'
import { ScenesPopover } from '../features/scenes/ScenesPopover.tsx'
import { useScenes } from '../features/scenes/useScenes.ts'
import { type CursorInfo, type SimMode, useSimLoop } from '../features/sim/useSimLoop.ts'
import { type Spawner } from '../features/spawners/spawners.ts'
import { useArmedConfirm } from '../hooks/useArmedConfirm.ts'
import { HOTKEYED_ENTRIES, useSiltHotkeys } from '../hooks/useSiltHotkeys.ts'
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

  const selectElement = (id: number): void => {
    setTool('paint')
    setSelectedElement(id)
  }

  const selectErase = (): void => {
    setTool('erase')
    setMode('paint')
  }

  useSiltHotkeys({
    onToggleRunning: () => setRunning((current) => !current),
    // Stepping is a paused-only action, like the header button that is disabled
    // while the sim runs.
    onStep: () => {
      if (!running) controls.step()
    },
    onSelectNth: (index) => {
      const entry = palette.entries[index]
      if (entry) selectElement(entry.id)
    },
    onSelectErase: selectErase,
    onNudgeBrush: (delta) =>
      setBrushIndex((current) => Math.min(BRUSH_WIDTHS.length - 1, Math.max(0, current + delta))),
    // The popover opens with the save, so the result — a new row, or a rename
    // prompt — is on screen rather than silently behind the button.
    onSaveScene: () => {
      setScenesOpen(true)
      scenes.save()
    },
    onCloseScenes: () => setScenesOpen(false),
  })

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

  const selectedName = tool === 'erase' ? 'erase' : palette.nameOf(selectedElement)

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
              <div
                key={group.label}
                className={styles.paletteGroup}
                data-testid={`palette-group-${group.label}`}
              >
                <span className={styles.groupLabel}>{group.label}</span>
                {group.entries.map((entry) => {
                  // Only the first `HOTKEYED_ENTRIES` swatches have a key to
                  // advertise, and the roster is longer than that. A badge
                  // reading "10" would name a shortcut that does nothing — see
                  // the hotkey gap in `.scratch/silt-materials/spec.md` §8.
                  const nth = palette.entries.indexOf(entry) + 1
                  const hotkey = nth <= HOTKEYED_ENTRIES ? nth : undefined
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
                      {hotkey !== undefined && (
                        <span className={styles.hotkey} data-testid="hotkey-badge">
                          {hotkey}
                        </span>
                      )}
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
                    className={styles.brushDot}
                    // True relative scale (spec §9): each icon's diameter is proportional
                    // to the brush's actual cell width, not just its position in the list.
                    // Drawn as a circle, not the spec's square, since the brush itself is round.
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
            onClick={selectErase}
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

            <WorldOverlay
              cursor={cursor}
              spawners={spawners}
              mode={mode}
              brushWidth={brushWidth}
              fit={controls}
              palette={palette}
              selectedElement={selectedElement}
              erasing={tool === 'erase'}
            />
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
