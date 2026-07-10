/**
 * TEMPORARY debug panel (mounted only with `?tune` in the URL) for dialling in
 * the ink-in-water look live. Edits the shared `liveTuning.current`; `useDoodle`
 * snapshots it every time it generates a field, so "New field" (or any slider
 * commit) re-runs the sim with the current knobs. "Copy settings" yields the
 * JSON to paste back so the chosen numbers can be baked into the consts.
 *
 * DELETE THIS FILE once the look is signed off — see `render/fluid.tuning.ts`.
 */
import { useState } from 'react'

import type { Brush } from './render/fluid.helpers.ts'
import {
  cloneTuning,
  DEFAULT_TUNING,
  liveDebug,
  liveTuning,
  type FluidTuning,
} from './render/fluid.tuning.ts'
import styles from './FluidTuner.module.scss'

type NumKey = Exclude<keyof FluidTuning, 'weights'>

/** [min, max, step] per numeric knob. */
const RANGES: Record<NumKey, [number, number, number]> = {
  radiusScale: [0.3, 1, 0.01],
  wobble: [0, 0.3, 0.005],
  trailDye: [0.5, 1, 0.01],
  peanutSep: [1, 3.5, 0.05],
  beanBend: [0, 2.5, 0.05],
  clumpSpread: [0.5, 3, 0.05],
  spikeArms: [2, 6, 1],
  spikeArmLen: [0.8, 4, 0.05],
  spikeKick: [0, 0.5, 0.01],
  archSpan: [1, 3.5, 0.05],
  archLeg: [0.8, 3, 0.05],
  vorticity: [0, 40, 0.5],
  densityDissipation: [0, 1, 0.01],
  velocityDissipation: [0, 4, 0.05],
  threshold: [0.1, 0.8, 0.01],
  smoothTexels: [0, 6, 0.1],
  edgeGain: [0, 1, 0.02],
  rimBand: [0, 0.5, 0.01],
  washMax: [0.4, 1, 0.02],
  grainAmount: [0, 0.4, 0.01],
  grainScale: [40, 300, 5],
}

const SECTIONS: { title: string; keys: NumKey[] }[] = [
  { title: 'Shape feel', keys: ['radiusScale', 'wobble', 'trailDye'] },
  { title: 'Peanut / Bean / Clump', keys: ['peanutSep', 'beanBend', 'clumpSpread'] },
  { title: 'Spike', keys: ['spikeArms', 'spikeArmLen', 'spikeKick'] },
  { title: 'Arch', keys: ['archSpan', 'archLeg'] },
  { title: 'Sim', keys: ['vorticity', 'densityDissipation', 'velocityDissipation'] },
  {
    title: 'Display',
    keys: ['threshold', 'smoothTexels', 'edgeGain', 'rimBand', 'washMax', 'grainAmount', 'grainScale'],
  },
]

const BRUSHES: Brush[] = ['dot', 'peanut', 'bean', 'clump', 'spike', 'arch']

interface Props {
  /** Re-run the field with the current knobs (wired to `newPage`). */
  onRegenerate: () => void
}

export function FluidTuner({ onRegenerate }: Props) {
  const [t, setLocal] = useState<FluidTuning>(() => cloneTuning(liveTuning.current))
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [grid, setGrid] = useState(liveDebug.grid)

  const toggleGrid = (): void => {
    const next = !grid
    setGrid(next)
    liveDebug.grid = next
    onRegenerate()
  }

  // Commit a mutated copy to both local state and the shared live object.
  const commit = (next: FluidTuning): void => {
    setLocal(next)
    liveTuning.current = next
    setCopied(false)
  }
  const setNum = (key: NumKey, value: number): void => commit({ ...cloneTuning(t), [key]: value })
  const setWeight = (b: Brush, value: number): void => {
    const next = cloneTuning(t)
    next.weights[b] = value
    commit(next)
  }
  const reset = (): void => {
    commit(cloneTuning(DEFAULT_TUNING))
    onRegenerate()
  }
  const copy = (): void => {
    void navigator.clipboard?.writeText(JSON.stringify(liveTuning.current, null, 2))
    setCopied(true)
  }

  if (collapsed) {
    return (
      <button className={styles.reopen} onClick={() => setCollapsed(false)}>
        ⚙︎ tune
      </button>
    )
  }

  return (
    <aside className={styles.panel}>
      <header className={styles.head}>
        <strong>fluid tuner</strong>
        <button className={styles.x} onClick={() => setCollapsed(true)}>
          ×
        </button>
      </header>

      <div className={styles.actions}>
        <button className={styles.primary} onClick={onRegenerate}>
          ↻ New field
        </button>
        <button onClick={reset}>Reset</button>
        <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy settings'}</button>
      </div>

      <label className={styles.gridToggle}>
        <input type="checkbox" checked={grid} onChange={toggleGrid} />
        Grid: one of each (fixed positions)
      </label>

      <section className={styles.section}>
        <h4>Frequency (weights)</h4>
        {BRUSHES.map((b) => (
          <Row
            key={b}
            label={b}
            value={t.weights[b]}
            min={0}
            max={6}
            step={1}
            onChange={(v) => setWeight(b, v)}
            onCommit={onRegenerate}
          />
        ))}
      </section>

      {SECTIONS.map((s) => (
        <section key={s.title} className={styles.section}>
          <h4>{s.title}</h4>
          {s.keys.map((key) => {
            const [min, max, step] = RANGES[key]
            return (
              <Row
                key={key}
                label={key}
                value={t[key]}
                min={min}
                max={max}
                step={step}
                onChange={(v) => setNum(key, v)}
                onCommit={onRegenerate}
              />
            )
          })}
        </section>
      ))}
    </aside>
  )
}

interface RowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  onCommit: () => void
}

function Row({ label, value, min, max, step, onChange, onCommit }: RowProps) {
  return (
    <label className={styles.row}>
      <span className={styles.name}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
      <span className={styles.val}>{value}</span>
    </label>
  )
}
