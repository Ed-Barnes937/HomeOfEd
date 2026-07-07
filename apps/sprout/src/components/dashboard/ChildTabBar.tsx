import type { KeyboardEvent } from 'react'
import { useCallback, useRef } from 'react'

import type { ChildSummary } from '../../features/children/childrenQueries.ts'
import { cn } from '../../lib/utils.ts'
import styles from './ChildTabBar.module.scss'

interface ChildTabBarProps {
  children: ChildSummary[]
  selectedChildId: string
  onSelect: (childId: string) => void
}

export function ChildTabBar({ children, selectedChildId, onSelect }: ChildTabBarProps) {
  const tablistRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const currentIndex = children.findIndex((c) => c.id === selectedChildId)
      if (currentIndex === -1) return

      let nextIndex: number | null = null
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % children.length
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + children.length) % children.length
      }

      const next = nextIndex !== null ? children[nextIndex] : undefined
      if (nextIndex !== null && next) {
        e.preventDefault()
        onSelect(next.id)
        const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        buttons?.[nextIndex]?.focus()
      }
    },
    [children, selectedChildId, onSelect],
  )

  return (
    <div ref={tablistRef} role="tablist" className={styles.tablist} onKeyDown={handleKeyDown}>
      {children.map((child) => {
        const isSelected = child.id === selectedChildId
        return (
          <button
            key={child.id}
            role="tab"
            aria-selected={isSelected}
            aria-controls={`tabpanel-${child.id}`}
            tabIndex={isSelected ? 0 : -1}
            id={`tab-${child.id}`}
            onClick={() => onSelect(child.id)}
            className={cn(styles.tab, isSelected && styles.tabSelected)}
          >
            {child.displayName}
          </button>
        )
      })}
    </div>
  )
}
