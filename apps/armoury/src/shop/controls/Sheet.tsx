import { useState } from 'react'

import { GroupControls } from './GroupControls.tsx'
import { LockButton, type ControlsProps } from './Panel.tsx'
import styles from './Sheet.module.scss'

export function Sheet({
  schema,
  groups: groupsOf,
  widget,
  copy,
  params,
  locked,
  onChange,
  onToggleLock,
  actions,
}: ControlsProps) {
  const groups = groupsOf(params)
  const [tab, setTab] = useState(() => groups[0]!.key)
  const group = groups.find((g) => g.key === tab) ?? groups[0]!

  return (
    <section className={styles.sheet} aria-label={copy.panelTitle}>
      <div className={styles.grip} aria-hidden="true" />
      <div className={styles.kind}>
        <GroupControls
          group="kind"
          schema={schema}
          params={params}
          onChange={onChange}
          widget={widget}
          inline
        />
      </div>
      <div className={styles.tabs} role="tablist" aria-label={copy.sheetTitle}>
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
        <GroupControls
          group={group.key}
          schema={schema}
          params={params}
          onChange={onChange}
          widget={widget}
        />
      </div>
      <footer className={styles.footer}>{actions}</footer>
    </section>
  )
}
