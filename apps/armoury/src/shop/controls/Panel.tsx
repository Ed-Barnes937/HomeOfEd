import { useState } from 'react'

import type { ItemSchema, Params } from '../../engine/schema.ts'
import type { GroupMeta, ShopCopy, ShopView } from '../shopView.ts'
import { GroupControls } from './GroupControls.tsx'
import styles from './Panel.module.scss'
import type { OnChange } from './Widgets.tsx'

export function LockButton({
  group,
  locked,
  onToggle,
}: {
  group: GroupMeta
  locked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={styles.lock}
      aria-pressed={locked}
      aria-label={`Keep ${group.title.replace('The ', 'the ')} when trying another`}
      title={locked ? 'Kept when you try another' : 'Keep this when you try another'}
      onClick={onToggle}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <rect x="3" y="7" width="10" height="7" rx="1.2" fill={locked ? 'currentColor' : 'none'} />
        <path
          d={locked ? 'M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7' : 'M5.5 7 V5 a2.5 2.5 0 0 1 4.9 -0.7'}
        />
      </svg>
    </button>
  )
}

export interface ControlsProps {
  schema: ItemSchema
  groups: ShopView['groups']
  widget: ShopView['widget']
  copy: ShopCopy
  params: Params
  locked: readonly string[]
  onChange: OnChange
  onToggleLock: (group: string) => void
  actions: React.ReactNode
}

export function Panel({
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
  const [closed, setClosed] = useState<readonly string[]>([])
  const toggle = (key: string) =>
    setClosed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))

  return (
    <aside className={styles.panel} aria-label={copy.panelTitle}>
      <div className={styles.sections}>
        <div className={styles.kind}>
          <GroupControls
            group="kind"
            schema={schema}
            params={params}
            onChange={onChange}
            widget={widget}
          />
        </div>
        {groups.map((group) => {
          const isOpen = !closed.includes(group.key)
          return (
            <section key={group.key} className={styles.section}>
              <div className={styles.header}>
                <button
                  type="button"
                  className={styles.toggle}
                  aria-expanded={isOpen}
                  onClick={() => toggle(group.key)}
                >
                  <span className={styles.numeral}>{group.numeral}</span>
                  <h2 className={styles.title}>{group.title}</h2>
                  <span className={styles.summary}>{group.summary(params)}</span>
                  <svg
                    className={styles.chevron}
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M3 4.5 L6 7.5 L9 4.5" />
                  </svg>
                </button>
                <LockButton
                  group={group}
                  locked={locked.includes(group.key)}
                  onToggle={() => onToggleLock(group.key)}
                />
              </div>
              {isOpen && (
                <div className={styles.body}>
                  <GroupControls
                    group={group.key}
                    schema={schema}
                    params={params}
                    onChange={onChange}
                    widget={widget}
                  />
                </div>
              )}
            </section>
          )
        })}
      </div>
      <footer className={styles.footer}>{actions}</footer>
    </aside>
  )
}
