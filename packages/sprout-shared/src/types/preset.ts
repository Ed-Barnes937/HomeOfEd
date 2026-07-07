export type PresetName = 'early-learner' | 'confident-reader' | 'independent-explorer'

export interface Preset {
  id: string
  childId: string
  name: PresetName
  vocabularyLevel: number
  responseDepth: number
  answeringStyle: number
  interactionMode: number
  topicAccess: number
  sessionLimits: number
  parentVisibility: number
}
