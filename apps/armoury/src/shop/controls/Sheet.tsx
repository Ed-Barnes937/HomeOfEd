import { useState } from 'react'

import type { Params } from '../../engine/schema.ts'
import { visibleGroups } from './groups.ts'
import { GroupControls } from './GroupControls.tsx'
import { LockButton } from './Panel.tsx'
import styles from './Sheet.module.scss'
import type { OnChange } from './Widgets.tsx'

export function Sheet({
  params,
  locked,
  onChange,
  onToggleLock,
  actions,
}: {
  params: Params
  locked: readonly string[]
  onChange: OnChange
  onToggleLock: (group: string) => void
  actions: React.ReactNode
}) {
  const [tab, setTab] = useState('finish')
  const groups = visibleGroups(params)
  const group = groups.find((g) => g.key === tab) ?? groups[0]!

  return (
    <section className={styles.sheet} aria-label="Make your wand">
      <div className={styles.grip} aria-hidden="true" />
      <div className={styles.kind}>
        <GroupControls group="kind" params={params} onChange={onChange} inline />
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Parts of the wand">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            id={`tab-${g.key}`}
            aria-selected={g.key === tab}
            aria-controls="sheet-panel"
            className={styles.tab}
            onClick={() => setTab(g.key)}
          >
            {g.tab}
          </button>
        ))}
      </div>
      <div
        className={styles.body}
        role="tabpanel"
        id="sheet-panel"
        aria-labelledby={`tab-${group.key}`}
      >
        <div className={styles.bodyHeader}>
          <span className={styles.summary}>{group.summary(params)}</span>
          <LockButton
            group={group}
            locked={locked.includes(group.key)}
            onToggle={() => onToggleLock(group.key)}
          />
        </div>
        <GroupControls group={group.key} params={params} onChange={onChange} />
      </div>
      <footer className={styles.footer}>{actions}</footer>
    </section>
  )
}
