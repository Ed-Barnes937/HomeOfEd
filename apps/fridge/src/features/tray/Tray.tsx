import { useState } from 'react'

import type { Finish, Wall } from '../board/model.ts'
import type { SpawnOpts } from '../board/useFridgeBoard.ts'
import { AppearanceColumn } from './AppearanceColumn.tsx'
import { ColorPicker } from './ColorPicker.tsx'
import { PaletteGrid } from './PaletteGrid.tsx'
import { Tabs, type TabKey } from './Tabs.tsx'
import styles from './Tray.module.scss'

/**
 * Bottom drawer (region D): the appearance column plus the add column (tabs,
 * colour picker, palette grid, hint). The active tab is local UI; finish,
 * light, colour pick, and spawning are driven by the board hook via props.
 */
export function Tray({
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
  /** Locks tile spawning while the board sweeps out. */
  disabled?: boolean
}) {
  const [tab, setTab] = useState<TabKey>('letters')

  return (
    <div className={styles.tray} data-testid="fridge-tray">
      <div className={styles.inner}>
        <AppearanceColumn finish={finish} wall={wall} onFinish={onFinish} onWall={onWall} />
        <div className={styles.add}>
          <div className={styles.top}>
            <Tabs active={tab} onSelect={setTab} />
            <ColorPicker pick={pick} onPick={onPick} />
          </div>
          <div className={styles.body}>
            <PaletteGrid tab={tab} onAdd={onAdd} disabled={disabled} />
          </div>
          <div className={styles.hint}>
            Tap to add · drag on the fridge to bump neighbours · click a magnet, then spin the knob
            or scroll to rotate
          </div>
        </div>
      </div>
    </div>
  )
}
