import { useState } from 'react'

import type { Finish, Wall } from '../board/model.ts'
import type { SpawnOpts } from '../board/useFridgeBoard.ts'
import { AppearanceColumn } from './AppearanceColumn.tsx'
import { ColorPicker } from './ColorPicker.tsx'
import { PaletteGrid } from './PaletteGrid.tsx'
import { Tabs, type TabKey } from './Tabs.tsx'
import styles from './AddPanel.module.scss'

/**
 * Mobile add flow (ADR 0023): a bottom-right FAB that opens a full-screen
 * overlay carrying the exact tray content — Tabs, ColorPicker, PaletteGrid,
 * and AppearanceColumn (finish + kitchen light), reused, not duplicated.
 * Tapping a tile adds a magnet to the board behind the overlay; the overlay
 * stays open for multiple adds and closes on an explicit Done. Rendered only
 * below the mobile breakpoint, so desktop keeps its inline tray untouched.
 */
export function AddPanel({
  finish,
  wall,
  pick,
  onPick,
  onAdd,
  onFinish,
  onWall,
  disabled = false,
}: {
  finish: Finish
  wall: Wall
  pick: number | null
  onPick: (index: number | null) => void
  onAdd: (opts: SpawnOpts) => void
  onFinish: (finish: Finish) => void
  onWall: (wall: Wall) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>('letters')

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        data-testid="add-fab"
        aria-label="Add magnets"
        onClick={() => setOpen(true)}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div className={styles.overlay} data-testid="add-overlay">
          <div className={styles.header}>
            <span className={styles.title}>Add magnets</span>
            <button
              type="button"
              className={styles.done}
              data-testid="add-overlay-close"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>

          <div className={styles.controls}>
            <Tabs active={tab} onSelect={setTab} />
            <ColorPicker pick={pick} onPick={onPick} />
          </div>

          <div className={styles.grid}>
            <PaletteGrid tab={tab} onAdd={onAdd} disabled={disabled} />
          </div>

          <AppearanceColumn finish={finish} wall={wall} onFinish={onFinish} onWall={onWall} />
        </div>
      )}
    </>
  )
}
