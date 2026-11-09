import type { ChildProfileRow } from '../../store.ts'

export interface ChildProfileView {
  id: string
  username: string
  displayName: string
  /** Epoch ms, the estate's wire convention for a tRPC surface with no transformer. */
  createdAt: number
}

export function toChildProfileView(row: ChildProfileRow): ChildProfileView {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    createdAt: row.createdAt.getTime(),
  }
}
