import styles from './Tabs.module.scss'

const TABS = [
  { key: 'letters', label: 'A B C' },
  { key: 'numbers', label: '1 2 3' },
  { key: 'shapes', label: 'Shapes' },
] as const

/** Which palette grid the tray shows. The Words tab is dropped in v1 (plan §2). */
export type TabKey = (typeof TABS)[number]['key']

export function Tabs({ active, onSelect }: { active: TabKey; onSelect: (key: TabKey) => void }) {
  return (
    <div className={styles.tabs}>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={styles.tab}
          data-active={t.key === active}
          onClick={() => onSelect(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
