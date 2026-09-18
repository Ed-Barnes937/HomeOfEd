import { useState } from 'react'

export interface CollapsedRows {
  isCollapsed: (instrumentId: string) => boolean
  toggle: (instrumentId: string) => void
}

/**
 * Which pitched rows are folded. Component state on purpose: collapse is a way
 * of looking at a clip, not part of it (spec §4, ADR 0061). Shared by the two
 * renderers so they cannot diverge in what folding a row means.
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
