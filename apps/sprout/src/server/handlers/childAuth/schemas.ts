// Shared output shape for the childAuth login/changePassword procedures — the
// child profile a device needs to run the chat UI + read parent-set guardrails.
import type { PresetName } from '@hoe/sprout-shared'

import type { SproutStore } from '../../store.ts'

export interface ChildAuthProfile {
  id: string
  displayName: string
  username: string
  presetName: PresetName
  parentId: string
  mustChangePassword: boolean
  /** False after a parent PIN reset — the forced-change screen must also
   * collect a fresh child-chosen PIN. */
  hasPin: boolean
}

type ChildRow = NonNullable<Awaited<ReturnType<SproutStore['getChild']>>>

/** Map a Store child row to the wire profile — the single place that derives
 * `hasPin` (and never leaks a hash). */
export const toChildAuthProfile = (child: ChildRow): ChildAuthProfile => ({
  id: child.id,
  displayName: child.displayName,
  username: child.username,
  presetName: child.presetName as PresetName,
  parentId: child.parentId,
  mustChangePassword: child.mustChangePassword,
  hasPin: child.pinHash !== null,
})
