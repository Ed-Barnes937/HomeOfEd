import type { ChildProfileView } from '@hoe/accounts'

import type { ChildProfileRow } from '../../store.ts'

export type { ChildProfileView }

export function toChildProfileView(row: ChildProfileRow): ChildProfileView {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    // Epoch ms, the estate's wire convention for a tRPC surface with no transformer.
    createdAt: row.createdAt.getTime(),
  }
}
