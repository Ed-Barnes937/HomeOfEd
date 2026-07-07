// Zod schemas shared across the children group (preset name, sliders,
// calibration answers). Kept in one place so create/update/preset/calibration
// validate identically.
import { z } from 'zod'

export const presetNameSchema = z.enum([
  'early-learner',
  'confident-reader',
  'independent-explorer',
])

const sliderValue = z.number().int().min(1).max(5)

/** All seven sliders required (a full preset). Use `.partial()` for patches. */
export const slidersSchema = z.object({
  vocabularyLevel: sliderValue,
  responseDepth: sliderValue,
  answeringStyle: sliderValue,
  interactionMode: sliderValue,
  topicAccess: sliderValue,
  sessionLimits: sliderValue,
  parentVisibility: sliderValue,
})

export const calibrationAnswerSchema = z.object({
  questionId: z.string(),
  selectedLevel: z.number().int().nullable(),
  customAnswer: z.string().nullable(),
})
