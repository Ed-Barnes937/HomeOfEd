import { describe, expect, it } from 'vitest'

import { detectSensitiveTopics } from './sensitive-topics.ts'

describe('detectSensitiveTopics', () => {
  describe('non-sensitive messages', () => {
    it('does not flag normal educational questions', () => {
      const result = detectSensitiveTopics('What is the biggest planet?')
      expect(result.isSensitive).toBe(false)
      expect(result.topics).toHaveLength(0)
      expect(result.escalatedPrompt).toBeNull()
    })

    it('does not flag creative requests', () => {
      const result = detectSensitiveTopics('Write me a story about a dragon')
      expect(result.isSensitive).toBe(false)
    })
  })

  describe('death and dying', () => {
    it('detects direct questions about death', () => {
      const result = detectSensitiveTopics('What happens when you die?')
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('death-and-dying')
    })

    it('detects questions about personal loss', () => {
      const result = detectSensitiveTopics('My grandma died last week')
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('death-and-dying')
    })
  })

  describe('reproduction', () => {
    it('detects the classic babies question', () => {
      const result = detectSensitiveTopics('Where do babies come from?')
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('reproduction')
    })

    it('detects pregnancy questions', () => {
      const result = detectSensitiveTopics('How does someone get pregnant?')
      expect(result.isSensitive).toBe(true)
    })
  })

  describe('violence and conflict', () => {
    it('detects questions about why people fight', () => {
      const result = detectSensitiveTopics('Why do people hurt each other?')
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('violence-and-conflict')
    })

    it('detects bullying topics', () => {
      const result = detectSensitiveTopics('Someone at school is bullying me')
      expect(result.isSensitive).toBe(true)
    })
  })

  describe('mental health', () => {
    it('detects depression references', () => {
      const result = detectSensitiveTopics('I feel really depressed')
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('mental-health')
    })

    it('detects self-harm references', () => {
      const result = detectSensitiveTopics('What is self-harm?')
      expect(result.isSensitive).toBe(true)
    })
  })

  describe('substances', () => {
    it('detects drug questions', () => {
      const result = detectSensitiveTopics('What are drugs?')
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('substances')
    })

    it('detects alcohol references', () => {
      const result = detectSensitiveTopics('Why do adults drink alcohol?')
      expect(result.isSensitive).toBe(true)
    })
  })

  describe('body and puberty', () => {
    it('detects puberty questions', () => {
      const result = detectSensitiveTopics('What is puberty?')
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('body-and-puberty')
    })
  })

  describe('family distress', () => {
    it('detects divorce questions', () => {
      const result = detectSensitiveTopics('My parents are getting a divorce')
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('family-distress')
    })
  })

  describe('false positives', () => {
    it("does not flag 'Jurassic period' as body-and-puberty", () => {
      const result = detectSensitiveTopics('What was the Jurassic period like?')
      expect(result.topics).not.toContain('body-and-puberty')
    })

    it("still detects 'got my period' as body-and-puberty", () => {
      const result = detectSensitiveTopics('I just got my period')
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('body-and-puberty')
    })
  })

  describe('multiple topics', () => {
    it('can detect multiple sensitive topics in one message', () => {
      const result = detectSensitiveTopics(
        'My grandpa died and now my parents are getting a divorce',
      )
      expect(result.isSensitive).toBe(true)
      expect(result.topics).toContain('death-and-dying')
      expect(result.topics).toContain('family-distress')
    })
  })

  describe('escalated prompt', () => {
    it('returns an escalated prompt when sensitive', () => {
      const result = detectSensitiveTopics('What happens when you die?')
      expect(result.escalatedPrompt).toBeTruthy()
      expect(result.escalatedPrompt?.toLowerCase()).toMatch(/sensitive/)
      expect(result.escalatedPrompt?.toLowerCase()).toMatch(/parent|trusted adult/)
    })

    it('returns null prompt when not sensitive', () => {
      const result = detectSensitiveTopics('What colour is the sky?')
      expect(result.escalatedPrompt).toBeNull()
    })
  })
})
