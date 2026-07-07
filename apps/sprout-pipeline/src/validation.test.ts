import { describe, expect, it } from 'vitest'

import {
  parseValidationResponse,
  buildValidationPrompt,
  type ValidationConfig,
} from './validation.ts'

const defaultConfig: ValidationConfig = {
  presetName: 'confident-reader',
  sliders: {
    vocabularyLevel: 3,
    responseDepth: 3,
    answeringStyle: 3,
    interactionMode: 3,
    topicAccess: 3,
    sessionLimits: 3,
    parentVisibility: 3,
  },
}

describe('parseValidationResponse', () => {
  it('parses APPROPRIATE response', () => {
    const result = parseValidationResponse(
      'APPROPRIATE: The response is age-appropriate and educational.',
    )
    expect(result.appropriate).toBe(true)
    expect(result.reason).toBe('The response is age-appropriate and educational.')
  })

  it('parses INAPPROPRIATE response', () => {
    const result = parseValidationResponse('INAPPROPRIATE: Contains graphic violence descriptions.')
    expect(result.appropriate).toBe(false)
    expect(result.reason).toBe('Contains graphic violence descriptions.')
  })

  it('defaults to inappropriate for unparseable responses (fail-safe)', () => {
    const result = parseValidationResponse("I think it's fine")
    expect(result.appropriate).toBe(false)
    expect(result.reason).toMatch(/unparseable/)
  })

  it('handles empty response as inappropriate', () => {
    const result = parseValidationResponse('')
    expect(result.appropriate).toBe(false)
  })

  it('trims whitespace before parsing', () => {
    const result = parseValidationResponse('  APPROPRIATE: Looks good  ')
    expect(result.appropriate).toBe(true)
    expect(result.reason).toBe('Looks good')
  })
})

describe('buildValidationPrompt', () => {
  it("includes the child's message", () => {
    const prompt = buildValidationPrompt(
      'How are babies made?',
      'Babies grow inside their mummy.',
      defaultConfig,
    )
    expect(prompt).toContain('How are babies made?')
  })

  it('includes the AI response', () => {
    const prompt = buildValidationPrompt(
      'Tell me about space',
      'Space is really big!',
      defaultConfig,
    )
    expect(prompt).toContain('Space is really big!')
  })

  it('reflects restricted topic access for low slider values', () => {
    const restricted: ValidationConfig = {
      ...defaultConfig,
      sliders: { ...defaultConfig.sliders, topicAccess: 1 },
    }
    const prompt = buildValidationPrompt('Hi', 'Hello!', restricted)
    expect(prompt.toLowerCase()).toMatch(/restricted/)
  })

  it('reflects open topic access for high slider values', () => {
    const open: ValidationConfig = {
      ...defaultConfig,
      sliders: { ...defaultConfig.sliders, topicAccess: 5 },
    }
    const prompt = buildValidationPrompt('Hi', 'Hello!', open)
    expect(prompt.toLowerCase()).toMatch(/open/)
  })

  it('includes the preset name', () => {
    const prompt = buildValidationPrompt('Hi', 'Hello!', defaultConfig)
    expect(prompt).toContain('confident-reader')
  })
})
