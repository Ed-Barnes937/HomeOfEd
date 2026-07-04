import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'

import { type Magnet, PALETTE } from './model.ts'
import styles from './MagnetView.module.scss'

export interface MagnetHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>, id: number) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: () => void
  onWheel: (e: ReactWheelEvent<HTMLDivElement>, id: number) => void
  onDoubleClick: (id: number) => void
}

/**
 * Renders one magnet, absolutely positioned by its surface-local x/y and
 * rotated in place. Colour is applied as CSS custom properties keyed by the
 * validated {@link PaletteKey} — no user-supplied string reaches inline style.
 * Matte recipe only (letters/numbers flat fill + extrude, fractions a conic
 * disc); the glossy recipe is not exposed in v1 (plan §6).
 *
 * When `active` (being dragged) it lifts to the top, scales up, and drops its
 * slide transition so it tracks the pointer 1:1. `handlers` wires drag/rotate/
 * remove to the board hook; they are optional so the static F4 scene still
 * renders without interaction.
 */
export function MagnetView({
  magnet,
  active = false,
  handlers,
}: {
  magnet: Magnet
  active?: boolean
  handlers?: MagnetHandlers
}) {
  const shades = PALETTE[magnet.color]
  const style = {
    left: magnet.x,
    top: magnet.y,
    width: magnet.w,
    height: magnet.h,
    zIndex: active ? 9999 : magnet.z,
    transform: `rotate(${magnet.rot}deg)${active ? ' scale(1.08)' : ''}`,
    transition: active ? 'none' : undefined,
    cursor: active ? 'grabbing' : 'grab',
    '--mag-main': shades.main,
    '--mag-dark': shades.dark,
    '--mag-light': shades.light,
    '--deg': `${magnet.deg}deg`,
  } as CSSProperties

  return (
    <div
      className={styles.magnet}
      style={style}
      data-testid="magnet"
      data-type={magnet.type}
      onPointerDown={handlers ? (e) => handlers.onPointerDown(e, magnet.id) : undefined}
      onPointerMove={handlers?.onPointerMove}
      onPointerUp={handlers?.onPointerUp}
      onWheel={handlers ? (e) => handlers.onWheel(e, magnet.id) : undefined}
      onDoubleClick={handlers ? () => handlers.onDoubleClick(magnet.id) : undefined}
    >
      {magnet.type === 'fraction' ? (
        <div className={styles.fraction} />
      ) : (
        <span className={magnet.type === 'number' ? styles.number : styles.letter}>
          {magnet.label}
        </span>
      )}
    </div>
  )
}
