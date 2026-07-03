import { useState } from 'react'

import { PARAM_RANGES, type SimParams } from '../sim/engine/params.ts'
import styles from './ControlPanel.module.scss'
import { Slider } from './Slider.tsx'

interface SliderSpec {
  key: keyof SimParams
  label: string
  format: (value: number) => string
}

// Order + formatting per the design handoff's SLIDERS spec.
const SLIDER_SPECS: SliderSpec[] = [
  { key: 'count', label: 'boids', format: (v) => String(Math.round(v)) },
  { key: 'speed', label: 'speed', format: (v) => v.toFixed(1) },
  { key: 'separation', label: 'separation', format: (v) => v.toFixed(2) },
  { key: 'alignment', label: 'alignment', format: (v) => v.toFixed(2) },
  { key: 'cohesion', label: 'cohesion', format: (v) => v.toFixed(2) },
  { key: 'vision', label: 'vision', format: (v) => `${Math.round(v)}px` },
  { key: 'trail', label: 'trail', format: (v) => `${Math.round(v * 100)}%` },
]

export interface ControlPanelProps {
  params: SimParams
  onParamsChange: (params: SimParams) => void
}

/**
 * The frosted-glass settings panel: header, collapse↔FAB, and the seven
 * behaviour sliders. THEME/SHAPE groups (design order: header → theme →
 * shape → hairline → sliders) land in B5.
 */
export function ControlPanel({ params, onParamsChange }: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.fab}
        aria-label="Open settings"
        onClick={() => setCollapsed(false)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M3 5.5h6M13 5.5h2M3 12.5h2M9 12.5h6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="11" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="7" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
    )
  }

  return (
    <aside className={styles.panel} role="dialog" aria-label="Simulation settings">
      <div className={styles.head}>
        <div className={styles.title}>
          <span className={styles.wordmark}>boids</span>
          <span className={styles.tag}>flock study</span>
        </div>
        <button
          type="button"
          className={styles.collapseButton}
          aria-label="Collapse settings"
          onClick={() => setCollapsed(true)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={styles.hairline} />

      {SLIDER_SPECS.map((spec) => (
        <Slider
          key={spec.key}
          label={spec.label}
          value={params[spec.key]}
          min={PARAM_RANGES[spec.key].min}
          max={PARAM_RANGES[spec.key].max}
          step={PARAM_RANGES[spec.key].step}
          format={spec.format}
          onChange={(value) => onParamsChange({ ...params, [spec.key]: value })}
        />
      ))}
    </aside>
  )
}
