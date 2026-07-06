// Shared output shape for the childAuth login/changePassword procedures — the
// child profile a device needs to run the chat UI + read parent-set guardrails.
import type { PresetName } from '../../domain/presets.ts'

export interface ChildAuthProfile {
  id: string
  displayName: string
  username: string
  presetName: PresetName
  parentId: string
  mustChangePassword: boolean
}
