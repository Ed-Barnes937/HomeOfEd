import { useMemo, useRef, useState } from 'react'

import { FieldNotesButton } from '../features/fieldNotes/FieldNotesButton.tsx'
import { FieldNotesPanel } from '../features/fieldNotes/FieldNotesPanel.tsx'
import { MomentCard } from '../features/fieldNotes/MomentCard.tsx'
import { useFieldNotes } from '../features/fieldNotes/useFieldNotes.ts'
import { useMoments } from '../features/fieldNotes/useMoments.ts'
import { EarnedElements } from '../features/palette/EarnedElements.tsx'
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
  const [earnedOpen, setEarnedOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const resetConfirm = useArmedConfirm<true>()

  // Field notes' progression: the rail reads it for the elements the player has
  // mastered and so earned back into it, and the header chip and panel read it
  // for everything else (spec §6).
  const fieldNotes = useFieldNotes()

  // The cards over the world, derived from field notes rather than from the
  // sim's report: the chip, the panel and the card are three readings of one
  // store, so none of them can be a discovery ahead of the others.
  const moments = useMoments(fieldNotes)

  // Reviewing happens on **close**, not open: advancing the watermark as the
  // panel opens would empty the `NEW n` chip on the very render that exists to
  // show it (`FieldNotesStore.markReviewed`).
  const closeNotes = (): void => {
    setNotesOpen(false)
    fieldNotes.markReviewed()
  }

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
    // The sim's one report back (spec §4). Everything downstream - the chip's
    // tick, the panel if it happens to be open, the rail's unlock, the card -
    // re-derives from the store this feeds; there is no second path.
    onWitnessed: fieldNotes.witness,
    witnessedAtBoot: fieldNotes.witnessed,
  })

  // Derived from the same registry the canvas paints from — never from
  // `v1Elements` directly — so the rail can't drift from the grid (ticket 16).
  // Base plus earned: the unlocked names arrive derived from the witnessed set,
  // so nothing here decides what has been mastered.
  const palette = useMemo(
    () => buildRailPalette(controls.registry, fieldNotes.unlocked),
    [controls.registry, fieldNotes.unlocked],
  )

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

  /**
   * Erase is a toggle, not a one-way door (ticket 24). While it is active no
   * rail swatch reads as pressed, so the erase button is the only lit control
   * and has to be the way back out; pressing it again resumes painting with
   * `selectedElement`, which erase never overwrote - it only shadowed it.
   */
  const toggleErase = (): void => {
    setTool((current) => (current === 'erase' ? 'paint' : 'erase'))
    // Entering erase leaves spawner mode - erase has no element to spawn, the
    // mirror of what the spawner button does to the tool. On the way back out
    // this is already true, so the one call covers both directions.
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
    onToggleErase: toggleErase,
    onNudgeBrush: (delta) =>
      setBrushIndex((current) => Math.min(BRUSH_WIDTHS.length - 1, Math.max(0, current + delta))),
    // The popover opens with the save, so the result — a new row, or a rename
    // prompt — is on screen rather than silently behind the button.
    onSaveScene: () => {
      setScenesOpen(true)
      scenes.save()
    },
    onDismissOverlays: () => {
      setScenesOpen(false)
      if (notesOpen) closeNotes()
    },
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
        <div className={styles.headerRight}>
          <FieldNotesButton
            seen={fieldNotes.totals.interactions.seen}
            total={fieldNotes.totals.interactions.total}
            open={notesOpen}
            onToggle={() => (notesOpen ? closeNotes() : setNotesOpen(true))}
          />
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
        </div>
      </header>

      {notesOpen ? (
        <FieldNotesPanel
          view={fieldNotes}
          registry={controls.registry}
          onClose={closeNotes}
          onForget={fieldNotes.reset}
        />
      ) : null}

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

          {/* The foot of the palette, and only once something has been earned
              (spec §6 "The unlock"): one control, never an inline swatch, so
              the rail's length and the 1-9 hotkeys above never move. It sits
              with the elements rather than after erase, which the bottom bar
              needs to keep as its last child (design brief §02). */}
          {palette.earned.length > 0 ? (
            <EarnedElements
              entries={palette.earned}
              moreToEarn={fieldNotes.moreToEarn}
              open={earnedOpen}
              onToggle={() => setEarnedOpen((open) => !open)}
              onClose={() => setEarnedOpen(false)}
              selectedId={tool === 'paint' ? selectedElement : EMPTY}
              onSelect={(id) => {
                selectElement(id)
                setEarnedOpen(false)
              }}
            />
          ) : null}

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
            onClick={toggleErase}
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

            {moments.card ? (
              <MomentCard
                moment={moments.card}
                registry={controls.registry}
                leaving={moments.leaving}
              />
            ) : null}

            {/* The 100% moment (spec §6): one line over the world, in the
                first-visit hint's own type and its own place, once ever. The
                two can never collide - the hint is gone before the first
                stroke, and this needs all 37. */}
            {moments.completing ? (
              <div
                className={`${styles.firstVisitHint} ${styles.chartComplete}`}
                data-testid="field-notes-complete"
              >
                every interaction witnessed
              </div>
            ) : null}

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
