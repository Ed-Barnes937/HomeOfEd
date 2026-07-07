import type { CalibrationAnswer, PresetName, PresetSliders } from '@hoe/sprout-shared'

export interface OnboardingData {
  displayName: string
  presetName: PresetName
  pin: string
  calibrationAnswers: CalibrationAnswer[]
  sliderOverrides: Partial<PresetSliders>
}

export const INITIAL_ONBOARDING_DATA: OnboardingData = {
  displayName: '',
  // Safe by default (6.5.9): a new child starts on the strictest preset.
  presetName: 'early-learner',
  pin: '',
  calibrationAnswers: [],
  sliderOverrides: {},
}
