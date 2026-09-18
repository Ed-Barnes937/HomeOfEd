import { useState } from 'react'

export interface CollapsedRows {
  isCollapsed: (instrumentId: string) => boolean
  toggle: (instrumentId: string) => void
}

/**
 * Which pitched rows are folded. Component state on purpose (spec §4, ADR
 * 0061), shared so the two renderers cannot diverge on what folding means.
 */
export function useCollapsedRows(): CollapsedRows {
  const [rows, setRows] = useState<ReadonlySet<string>>(() => new Set())
  return {
    isCollapsed: (instrumentId) => rows.has(instrumentId),
    toggle: (instrumentId) =>
      setRows((current) => {
        const next = new Set(current)
        if (!next.delete(instrumentId)) next.add(instrumentId)
        return next
      }),
  }
}
