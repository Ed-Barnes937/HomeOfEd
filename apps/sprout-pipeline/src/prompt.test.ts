import type { CalibrationAnswer, PresetSliders } from '@hoe/sprout-shared'
import { describe, expect, it } from 'vitest'

import { buildSystemPrompt } from './prompt.ts'

const defaultSliders: PresetSliders = {
  vocabularyLevel: 3,
  responseDepth: 3,
  answeringStyle: 3,
  interactionMode: 3,
  topicAccess: 3,
  sessionLimits: 3,
  parentVisibility: 3,
}

describe('buildSystemPrompt', () => {
  describe('basic structure', () => {
    it('returns a non-empty string', () => {
      const result = buildSystemPrompt({
        presetName: 'confident-reader',
        sliders: defaultSliders,
      })
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('includes the core persona instruction (favourite teacher tone)', () => {
      const result = buildSystemPrompt({
        presetName: 'confident-reader',
        sliders: defaultSliders,
      })
      expect(result.toLowerCase()).toMatch(/friendly|approachable|encouraging/)
    })

    it('always includes the honesty instruction', () => {
      const result = buildSystemPrompt({
        presetName: 'confident-reader',
        sliders: defaultSliders,
      })
      expect(result.toLowerCase()).toMatch(/honest|don't know|not sure|uncertain/)
    })
  })

  describe('vocabulary level slider', () => {
    it('instructs simple vocabulary when slider is 1', () => {
      const result = buildSystemPrompt({
        presetName: 'early-learner',
        sliders: { ...defaultSliders, vocabularyLevel: 1 },
      })
      expect(result.toLowerCase()).toMatch(/simple\b.*\b(words|vocabulary|language)/)
    })

    it('allows rich vocabulary when slider is 5', () => {
      const result = buildSystemPrompt({
        presetName: 'independent-explorer',
        sliders: { ...defaultSliders, vocabularyLevel: 5 },
      })
      expect(result.toLowerCase()).toMatch(/rich|advanced|sophisticated|natural|full/)
    })
  })

  describe('response depth slider', () => {
    it('instructs short responses when slider is 1', () => {
      const result = buildSystemPrompt({
        presetName: 'early-learner',
        sliders: { ...defaultSliders, responseDepth: 1 },
      })
      expect(result.toLowerCase()).toMatch(/short|brief|concise|2-3 sentences/)
    })

    it('allows detailed responses when slider is 5', () => {
      const result = buildSystemPrompt({
        presetName: 'independent-explorer',
        sliders: { ...defaultSliders, responseDepth: 5 },
      })
      expect(result.toLowerCase()).toMatch(/detailed|in-depth|thorough/)
    })
  })

  describe('answering style slider', () => {
    it('uses socratic style when slider is 1', () => {
      const result = buildSystemPrompt({
        presetName: 'early-learner',
        sliders: { ...defaultSliders, answeringStyle: 1 },
      })
      expect(result.toLowerCase()).toMatch(/question|guide|socratic|think.*about/)
    })

    it('uses direct answers when slider is 5', () => {
      const result = buildSystemPrompt({
        presetName: 'independent-explorer',
        sliders: { ...defaultSliders, answeringStyle: 5 },
      })
      expect(result.toLowerCase()).toMatch(/direct|straightforward/)
    })
  })

  describe('topic access slider', () => {
    it('restricts topics when slider is 1', () => {
      const result = buildSystemPrompt({
        presetName: 'early-learner',
        sliders: { ...defaultSliders, topicAccess: 1 },
      })
      expect(result.toLowerCase()).toMatch(/restrict|redirect|ask.*(parent|grown-up|adult)/)
    })

    it('allows broader topics when slider is 5', () => {
      const result = buildSystemPrompt({
        presetName: 'independent-explorer',
        sliders: { ...defaultSliders, topicAccess: 5 },
      })
      expect(result.toLowerCase()).toMatch(/open|broad|honestly|wide range/)
    })
  })

  describe('calibration answers', () => {
    it('includes calibration guidance when answers are provided', () => {
      const calibration: CalibrationAnswer[] = [
        { questionId: 'babies', selectedLevel: 1, customAnswer: null },
      ]
      const result = buildSystemPrompt({
        presetName: 'confident-reader',
        sliders: defaultSliders,
        calibrationAnswers: calibration,
      })
      // Should reference the topic and the cautious approach
      expect(result.toLowerCase()).toMatch(/reproduction|babies|where.*come from/)
    })

    it('includes custom parent answer when provided', () => {
      const customText = 'Babies are a gift from the stork'
      const calibration: CalibrationAnswer[] = [
        { questionId: 'babies', selectedLevel: null, customAnswer: customText },
      ]
      const result = buildSystemPrompt({
        presetName: 'confident-reader',
        sliders: defaultSliders,
        calibrationAnswers: calibration,
      })
      expect(result).toContain(customText)
    })

    it('handles multiple calibration answers', () => {
      const calibration: CalibrationAnswer[] = [
        { questionId: 'babies', selectedLevel: 2, customAnswer: null },
        { questionId: 'death', selectedLevel: 1, customAnswer: null },
      ]
      const result = buildSystemPrompt({
        presetName: 'confident-reader',
        sliders: defaultSliders,
        calibrationAnswers: calibration,
      })
      expect(result.toLowerCase()).toMatch(/reproduction|babies/)
      expect(result.toLowerCase()).toMatch(/death|dying|die/)
    })

    it('works without calibration answers', () => {
      const result = buildSystemPrompt({
        presetName: 'confident-reader',
        sliders: defaultSliders,
      })
      expect(result).toBeTruthy()
    })
  })

  describe('absolute blockers', () => {
    it('always includes absolute blocker instructions regardless of settings', () => {
      const openResult = buildSystemPrompt({
        presetName: 'independent-explorer',
        sliders: { ...defaultSliders, topicAccess: 5 },
      })
      const restrictedResult = buildSystemPrompt({
        presetName: 'early-learner',
        sliders: { ...defaultSliders, topicAccess: 1 },
      })

      // Both should contain absolute blocker instructions
      for (const result of [openResult, restrictedResult]) {
        expect(result.toLowerCase()).toMatch(/never|must not|do not|refuse|under no circumstances/)
        expect(result.toLowerCase()).toMatch(/explicit|harmful|dangerous|illegal/)
      }
    })
  })

  describe('preset differentiation', () => {
    it('produces different prompts for different presets with same sliders', () => {
      const earlyLearner = buildSystemPrompt({
        presetName: 'early-learner',
        sliders: defaultSliders,
      })
      const explorer = buildSystemPrompt({
        presetName: 'independent-explorer',
        sliders: defaultSliders,
      })
      expect(earlyLearner).not.toBe(explorer)
    })
  })
})
