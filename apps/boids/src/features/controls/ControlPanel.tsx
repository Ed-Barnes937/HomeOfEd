import { type ReactNode, useState } from 'react'

import { PARAM_RANGES, type SimParams } from '../sim/engine/params.ts'
import type { BoidShape } from '../sim/render/renderer.ts'
import type { CursorIcon, ThemeId } from '../sim/settings.ts'
import styles from './ControlPanel.module.scss'
import { CursorIconPicker } from './CursorIconPicker.tsx'
import { ShapePicker } from './ShapePicker.tsx'
import { Slider } from './Slider.tsx'
import { ThemePicker } from './ThemePicker.tsx'

interface SliderSpec {
  key: keyof SimParams
  label: string
  format: (value: number) => string
}

// Boid-options sliders: order + formatting per the design handoff's SLIDERS spec.
const BOID_SLIDER_SPECS: SliderSpec[] = [
  { key: 'count', label: 'boids', format: (v) => String(Math.round(v)) },
  { key: 'speed', label: 'speed', format: (v) => v.toFixed(1) },
  { key: 'separation', label: 'separation', format: (v) => v.toFixed(2) },
  { key: 'alignment', label: 'alignment', format: (v) => v.toFixed(2) },
  { key: 'cohesion', label: 'cohesion', format: (v) => v.toFixed(2) },
  { key: 'vision', label: 'vision', format: (v) => `${Math.round(v)}px` },
  { key: 'trail', label: 'trail', format: (v) => `${Math.round(v * 100)}%` },
  { key: 'size', label: 'boid size', format: (v) => `${v.toFixed(1)}×` },
]

// Cursor-options slider: the bipolar pointer force.
const CURSOR_SLIDER_SPEC: SliderSpec = {
  key: 'cursor',
  label: 'cursor attraction',
  format: (v) => (v === 0 ? 'off' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`),
}

/** A titled, collapsible subsection. Header toggles the body; open by default. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.sectionHeader}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.sectionTitle}>{title}</span>
        <svg
          className={open ? styles.chevronOpen : styles.chevron}
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 4.2l2.5 2.6L8 4.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  )
}

export interface ControlPanelProps {
  theme: ThemeId
  onThemeChange: (theme: ThemeId) => void
  shape: BoidShape
  onShapeChange: (shape: BoidShape) => void
  cursorIcon: CursorIcon
  onCursorIconChange: (icon: CursorIcon) => void
  params: SimParams
  onParamsChange: (params: SimParams) => void
}

/** The frosted-glass settings panel: header, theme, shape, cursor, sliders, collapse↔FAB. */
export function ControlPanel({
  theme,
  onThemeChange,
  shape,
  onShapeChange,
  cursorIcon,
  onCursorIconChange,
  params,
  onParamsChange,
}: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const renderSlider = (spec: SliderSpec) => (
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
  )

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

      <div className={styles.groupLabel}>theme</div>
      <ThemePicker value={theme} onChange={onThemeChange} />

      <div className={styles.groupLabel} style={{ marginTop: 22 }}>
        shape
      </div>
      <ShapePicker value={shape} onChange={onShapeChange} />

      <Section title="boid options">{BOID_SLIDER_SPECS.map(renderSlider)}</Section>

      <Section title="cursor options">
        <div className={styles.groupLabel}>cursor icon</div>
        <CursorIconPicker value={cursorIcon} onChange={onCursorIconChange} />
        {renderSlider(CURSOR_SLIDER_SPEC)}
      </Section>
    </aside>
  )
}
