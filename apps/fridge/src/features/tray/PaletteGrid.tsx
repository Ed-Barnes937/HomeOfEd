import { FRACTIONS } from '../board/model.ts'
import type { SpawnOpts } from '../board/useFridgeBoard.ts'
import type { TabKey } from './Tabs.tsx'
import styles from './PaletteGrid.module.scss'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const NUMBERS = '0123456789'.split('')

/**
 * The add-a-magnet palette body for the active tab: 26 letter tiles, 0–9
 * number tiles, or the 5 shape discs. Tapping a tile spawns that magnet via
 * `onAdd` — the board hook places it with the engine and settles the scene.
 */
export function PaletteGrid({ tab, onAdd }: { tab: TabKey; onAdd: (opts: SpawnOpts) => void }) {
  if (tab === 'shapes') {
    return (
      <div className={styles.shapes}>
        {FRACTIONS.map((f) => (
          <button
            key={f.glyph}
            type="button"
            className={styles.shape}
            onClick={() => onAdd({ type: 'fraction', label: '', deg: f.deg })}
          >
            {f.glyph}
          </button>
        ))}
      </div>
    )
  }

  const type = tab === 'numbers' ? 'number' : 'letter'
  const items = tab === 'numbers' ? NUMBERS : LETTERS
  return (
    <div className={styles.grid}>
      {items.map((ch) => (
        <button
          key={ch}
          type="button"
          className={styles.tile}
          onClick={() => onAdd({ type, label: ch, deg: 0 })}
        >
          {ch}
        </button>
      ))}
    </div>
  )
}
