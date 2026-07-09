import type { Tool } from '../doodle/useDoodle.ts'
import styles from './ToolToggle.module.scss'

export interface ToolToggleProps {
  value: Tool
  onChange: (tool: Tool) => void
}

// Glyphs are decorative flourishes on the label, not the label itself (spec §11.2).
const TOOLS: { id: Tool; label: string; glyph: string }[] = [
  { id: 'pen', label: 'Pen', glyph: '✎' },
  { id: 'eyes', label: 'Eyes', glyph: '◉' },
]

/** Pen | Eyes segmented toggle. Active = accent bg / white text (spec §11.2). */
export function ToolToggle({ value, onChange }: ToolToggleProps) {
  return (
    <div className={styles.seg} role="group" aria-label="Tool">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={styles.button}
          aria-pressed={t.id === value}
          onClick={() => onChange(t.id)}
        >
          <span className={styles.glyph} aria-hidden="true">
            {t.glyph}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  )
}
