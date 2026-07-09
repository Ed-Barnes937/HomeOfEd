import { rakePresets } from '../garden/engine/rake.ts'
import type { RakeId } from '../garden/engine/state.ts'
import styles from './RakePicker.module.scss'

const RAKE_IDS: RakeId[] = ['marble', 'wide', 'deep', 'fine']

// Tine-bar heights per head, matching the reference's `barSets`; marble has no
// bars (it draws a single dot instead).
const BAR_HEIGHTS: Record<RakeId, number[]> = {
  marble: [],
  wide: [3, 3, 3, 3],
  deep: [4.5, 4.5, 4.5],
  fine: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
}
const BAR_GAP: Record<RakeId, number> = { marble: 3, wide: 3, deep: 4, fine: 2 }

function label(id: RakeId): string {
  return id[0]!.toUpperCase() + id.slice(1)
}

export interface RakePickerProps {
  rake: RakeId
  onChange: (rake: RakeId) => void
}

/** The 4 rake-head cards: a marble dot vs. tine-bar glyph, dark when selected. */
export function RakePicker({ rake, onChange }: RakePickerProps) {
  const presets = rakePresets()
  return (
    <div className={styles.wrap}>
      <div className={styles.colhd}>Rake head</div>
      <div className={styles.row}>
        {RAKE_IDS.map((id) => {
          const selected = id === rake
          const tines = presets[id].tines
          return (
            <button
              key={id}
              type="button"
              className={styles.card}
              data-testid={`rake-${id}`}
              aria-pressed={selected}
              aria-label={`${label(id)} rake`}
              onClick={() => onChange(id)}
            >
              <span className={styles.glyph}>
                {id === 'marble' ? (
                  <span className={styles.marble} />
                ) : (
                  <span className={styles.bars} style={{ gap: BAR_GAP[id] }}>
                    {BAR_HEIGHTS[id].map((h, i) => (
                      <span key={i} className={styles.bar} style={{ height: h }} />
                    ))}
                  </span>
                )}
              </span>
              <span className={styles.name}>{label(id)}</span>
              <span className={styles.tines}>{tines === 1 ? '1 tine' : `${tines} tines`}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
