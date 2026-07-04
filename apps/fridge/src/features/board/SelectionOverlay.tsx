import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

import type { Magnet } from './model.ts'
import styles from './SelectionOverlay.module.scss'

/**
 * The selection chrome that tracks the selected magnet's box + rotation: a
 * dashed ring, a rotate stalk + knob (drag to rotate live, snaps on release),
 * and a delete ×. Positioned exactly over the magnet; only the knob and × are
 * interactive (the wrapper is pointer-transparent). Recipe from the handoff §C.
 */
export function SelectionOverlay({
  magnet,
  active,
  onKnobPointerDown,
  onKnobPointerMove,
  onKnobPointerUp,
  onDelete,
}: {
  magnet: Magnet
  active: boolean
  onKnobPointerDown: (e: ReactPointerEvent<HTMLDivElement>, id: number) => void
  onKnobPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onKnobPointerUp: () => void
  onDelete: (id: number) => void
}) {
  const style = {
    left: magnet.x,
    top: magnet.y,
    width: magnet.w,
    height: magnet.h,
    transform: `rotate(${magnet.rot}deg)${active ? ' scale(1.08)' : ''}`,
  } as CSSProperties

  return (
    <div
      className={styles.wrap}
      style={style}
      data-active={active}
      data-testid="selection-overlay"
    >
      <div className={styles.ring} data-round={magnet.type === 'fraction' ? 'circle' : 'box'} />
      <div className={styles.stalk} />
      <div
        className={styles.knob}
        data-testid="magnet-knob"
        onPointerDown={(e) => onKnobPointerDown(e, magnet.id)}
        onPointerMove={onKnobPointerMove}
        onPointerUp={onKnobPointerUp}
      >
        <div className={styles.knobMark} />
      </div>
      <button
        type="button"
        className={styles.del}
        data-testid="magnet-delete"
        aria-label="remove magnet"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onDelete(magnet.id)
        }}
      >
        ×
      </button>
    </div>
  )
}
