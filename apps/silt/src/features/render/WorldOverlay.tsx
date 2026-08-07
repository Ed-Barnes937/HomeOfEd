import type { RailPalette } from '../palette/paletteGroups.ts'
import type { CursorInfo, SimMode, UseSimLoopControls } from '../sim/useSimLoop.ts'
import type { Spawner } from '../spawners/spawners.ts'
import styles from './WorldOverlay.module.scss'

/**
 * The canvas fit, as the chrome drawn over the world needs it: where a cell
 * lands on screen, and how big a cell is — and nothing else the loop can do.
 */
export type WorldFit = Pick<UseSimLoopControls, 'gridToCanvasPoint' | 'cellSize'>


export interface WorldOverlayProps {
  /** Where the pointer is, or `null` once it has left the canvas. */
  cursor: CursorInfo | null
  spawners: readonly Spawner[]
  mode: SimMode
  /** Square brush width in cells — the paint cursor is drawn at true size. */
  brushWidth: number
  fit: WorldFit
  palette: RailPalette
  /** The species a spawner placed now would carry — the placement ghost's colour. */
  selectedElement: number
}

/**
 * Everything drawn over the world canvas in CSS-px terms: the brush cursor,
 * the placed spawners and their removal state, and the placement ghost. It
 * renders as a fragment, so the elements position against the canvas wrapper
 * the page puts them in.
 */
export function WorldOverlay({
  cursor,
  spawners,
  mode,
  brushWidth,
  fit,
  palette,
  selectedElement,
}: WorldOverlayProps) {
  // The hovered cell, in spawner mode, may already hold a spawner — that one
  // renders red-with-minus instead of the placement ghost (spec §7, §9).
  const hoveredSpawnerIndex =
    mode === 'spawner' && cursor
      ? spawners.findIndex((spawner) => spawner.x === cursor.cell.x && spawner.y === cursor.cell.y)
      : -1

  return (
    <>
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
        const point = fit.gridToCanvasPoint(spawner.x, spawner.y)
        if (!point) return null
        const size = fit.cellSize()
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
    </>
  )
}
