import type { Tool } from '../doodle/useDoodle.ts'
import { HelpHint } from './HelpHint.tsx'
import { NibPicker } from './NibPicker.tsx'
import { ToolToggle } from './ToolToggle.tsx'
import styles from './Toolbar.module.scss'

export interface ToolbarProps {
  tool: Tool
  setTool: (tool: Tool) => void
  nib: number
  setNib: (width: number) => void
  newPage: () => void
  undo: () => void
  canUndo: boolean
  save: () => Promise<void>
  /** How-to-play copy, surfaced via the `?` hint when the subtitle is hidden. */
  hint: string
}

/**
 * Docked toolbar: ToolToggle + NibPicker left, Undo/New page/Save right,
 * pushed apart by a flex:1 spacer. Wraps to a second row when tight (spec §11.2).
 */
export function Toolbar({
  tool,
  setTool,
  nib,
  setNib,
  newPage,
  undo,
  canUndo,
  save,
  hint,
}: ToolbarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <ToolToggle value={tool} onChange={setTool} />
        <NibPicker value={nib} onChange={setNib} />
        <HelpHint text={hint} />
      </div>
      <div className={styles.spacer} />
      <div className={styles.right}>
        <button
          type="button"
          className={styles.ghost}
          onClick={undo}
          disabled={!canUndo}
          aria-disabled={!canUndo}
        >
          Undo
        </button>
        <button type="button" className={styles.ghost} onClick={newPage}>
          New page
        </button>
        <button type="button" className={styles.primary} onClick={() => void save()}>
          Save
        </button>
      </div>
    </div>
  )
}
