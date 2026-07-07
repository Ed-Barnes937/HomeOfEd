import { describe, expect, it } from 'vitest'

import { scanOutput } from './blocklist.ts'

describe('scanOutput', () => {
  describe('clean content', () => {
    it('passes clean educational content', () => {
      const result = scanOutput('The sun is a big star that gives us light and warmth.')
      expect(result.blocked).toBe(false)
      expect(result.matches).toHaveLength(0)
    })

    it('passes content about sensitive topics discussed appropriately', () => {
      const result = scanOutput(
        'When a person dies, their body stops working. Different families have different beliefs about what happens next.',
      )
      expect(result.blocked).toBe(false)
    })
  })

  describe('profanity and slurs (obscenity library)', () => {
    it('catches common profanity', () => {
      const result = scanOutput('What the fuck is that?')
      expect(result.blocked).toBe(true)
      expect(result.matches.some((m) => m.category === 'profanity')).toBe(true)
    })

    it('catches profanity regardless of case', () => {
      const result = scanOutput("That's BULLSHIT")
      expect(result.blocked).toBe(true)
    })

    it('catches leet-speak evasion', () => {
      const result = scanOutput("You're such a b1tch")
      expect(result.blocked).toBe(true)
    })

    it('catches symbol substitution', () => {
      const result = scanOutput('What the f@ck')
      expect(result.blocked).toBe(true)
    })

    it('does not false-positive on words containing blocked substrings', () => {
      const result = scanOutput("I'm your helpful assistant")
      expect(result.blocked).toBe(false)
    })

    it("does not false-positive on 'class' or 'pass'", () => {
      const result = scanOutput("Let's go to class and pass the test")
      expect(result.blocked).toBe(false)
    })

    it("does not false-positive on 'assassin'", () => {
      const result = scanOutput('The assassin crept through the castle in the story')
      expect(result.blocked).toBe(false)
    })

    it("does not false-positive on 'Niger' or 'Nigeria'", () => {
      const result = scanOutput('Niger and Nigeria are countries in West Africa')
      expect(result.blocked).toBe(false)
    })

    it("does not false-positive on 'cocktail' or 'cockpit'", () => {
      const result = scanOutput('The pilot sat in the cockpit sipping a fruit cocktail')
      expect(result.blocked).toBe(false)
    })
  })

  describe('educational terms are allowed', () => {
    it("allows 'penis' in educational context", () => {
      const result = scanOutput('The penis is a body part that boys and men have.')
      expect(result.blocked).toBe(false)
    })

    it("allows 'vagina' in educational context", () => {
      const result = scanOutput('The vagina is a body part that girls and women have.')
      expect(result.blocked).toBe(false)
    })

    it("allows 'sex' in educational context", () => {
      const result = scanOutput('The sex of an animal can be male or female.')
      expect(result.blocked).toBe(false)
    })
  })

  describe('URLs and contact info', () => {
    it('catches http URLs', () => {
      const result = scanOutput('Check out http://example.com for more info')
      expect(result.blocked).toBe(true)
      expect(result.matches.some((m) => m.category === 'contact-info')).toBe(true)
    })

    it('catches https URLs', () => {
      const result = scanOutput('Visit https://www.example.com/page')
      expect(result.blocked).toBe(true)
    })

    it('catches www URLs without protocol', () => {
      const result = scanOutput('Go to www.example.com')
      expect(result.blocked).toBe(true)
    })

    it('catches email addresses', () => {
      const result = scanOutput('Email me at someone@example.com')
      expect(result.blocked).toBe(true)
      expect(result.matches.some((m) => m.category === 'contact-info')).toBe(true)
    })

    it('catches phone numbers', () => {
      const result = scanOutput('Call me on 07911 123456')
      expect(result.blocked).toBe(true)
    })

    it('catches phone numbers with country code', () => {
      const result = scanOutput('Ring +44 20 7946 0958')
      expect(result.blocked).toBe(true)
    })

    it('does not false-positive on spaced scientific numbers', () => {
      const result = scanOutput('The speed of light is 299 792 458 metres per second')
      expect(result.blocked).toBe(false)
    })
  })

  describe('dangerous content', () => {
    it('catches weapon-making instructions', () => {
      const result = scanOutput("Here's how to make a bomb at home")
      expect(result.blocked).toBe(true)
      expect(result.matches.some((m) => m.category === 'dangerous')).toBe(true)
    })

    it('catches drug manufacturing references', () => {
      const result = scanOutput('To make methamphetamine you need')
      expect(result.blocked).toBe(true)
    })

    it("still catches plural 'make bombs'", () => {
      const result = scanOutput("Here's how to make bombs at home")
      expect(result.blocked).toBe(true)
    })

    it("does not false-positive on 'make a bomber jacket'", () => {
      const result = scanOutput('I want to make a bomber jacket')
      expect(result.blocked).toBe(false)
    })
  })

  describe('canonicalisation pre-filter (6.5.1)', () => {
    it('catches homoglyph-obfuscated dangerous content', () => {
      // Cyrillic о (U+043E) — breaks the raw regex, folded on the scan copy.
      const result = scanOutput('how to make a bоmb')
      expect(result.blocked).toBe(true)
      expect(result.matches.some((m) => m.category === 'dangerous')).toBe(true)
    })

    it('catches zero-width-split profanity', () => {
      const result = scanOutput(`what a piece of sh${'​'}it`)
      expect(result.blocked).toBe(true)
      expect(result.matches.some((m) => m.category === 'profanity')).toBe(true)
    })

    it('catches emoji-substituted dangerous content', () => {
      const result = scanOutput("here's how to make a \u{1F4A3} at home")
      expect(result.blocked).toBe(true)
    })

    it('still catches phone numbers (contact-info uses the raw text)', () => {
      const result = scanOutput('Call me on 07911 123456')
      expect(result.blocked).toBe(true)
    })
  })

  describe('result structure', () => {
    it('returns all matching categories', () => {
      const result = scanOutput('fuck, visit http://evil.com')
      expect(result.blocked).toBe(true)
      const categories = result.matches.map((m) => m.category)
      expect(categories).toContain('profanity')
      expect(categories).toContain('contact-info')
    })

    it('includes the matched term in results', () => {
      const result = scanOutput('Check http://example.com now')
      expect(result.blocked).toBe(true)
      expect(result.matches[0]?.matched).toBeTruthy()
    })
  })
})
