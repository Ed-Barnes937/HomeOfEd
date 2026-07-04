import type { PointerEvent as ReactPointerEvent, ReactNode, Ref } from 'react'

import type { Finish } from './model.ts'
import styles from './FridgeDoor.module.scss'

/**
 * The fridge door: a brushed-steel base with a finish overlay on top, the
 * inset magnet surface (where magnets live), and the chrome handle. The board
 * hook owns `surfaceRef` (measured for spawn/drag bounds) and drives
 * `onSurfacePointerDown` to deselect when the empty surface is clicked.
 */
export function FridgeDoor({
  finish,
  surfaceRef,
  onSurfacePointerDown,
  children,
}: {
  finish: Finish
  surfaceRef?: Ref<HTMLDivElement>
  onSurfacePointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
  children?: ReactNode
}) {
  return (
    <div className={styles.door} data-testid="fridge-door">
      <div className={styles.finish} data-finish={finish} />
      <div className={styles.surface} ref={surfaceRef} onPointerDown={onSurfacePointerDown}>
        {children}
      </div>
      <div className={styles.handle} />
    </div>
  )
}
