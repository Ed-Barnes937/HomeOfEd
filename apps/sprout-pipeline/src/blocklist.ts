import { findPhoneNumbersInText } from 'libphonenumber-js'
import { RegExpMatcher, DataSet, englishDataset, englishRecommendedTransformers } from 'obscenity'

import { canonicaliseForScan } from './canonicalise.ts'

export interface BlocklistMatch {
  category: 'profanity' | 'explicit' | 'dangerous' | 'contact-info'
  matched: string
}

export interface BlocklistResult {
  blocked: boolean
  matches: BlocklistMatch[]
}

// Customise the english dataset: remove medical/educational terms that may
// appear legitimately in age-appropriate explanations. The sensitive topics
// system + validation model handle appropriateness of these terms.
const EDUCATIONAL_TERMS = ['penis', 'vagina', 'sex']

const customDataset = new DataSet<{ originalWord: string }>()
  .addAll(englishDataset)
  .removePhrasesIf((phrase) => EDUCATIONAL_TERMS.includes(phrase.metadata?.originalWord ?? ''))

const datasetBuild = customDataset.build()

const matcher = new RegExpMatcher({
  ...datasetBuild,
  ...englishRecommendedTransformers,
  // Extend the library's whitelist with additional false-positive terms
  whitelistedTerms: [
    ...(datasetBuild.whitelistedTerms ?? []),
    'cockpit',
    'cocktail',
    'cockatoo',
    'cockerel',
    'cocoa',
    'peacock',
  ],
})

// Dangerous content patterns — domain-specific, no library covers these
const DANGEROUS_PATTERNS: RegExp[] = [
  /\b(?:make|build|create|construct)\s+(?:a\s+)?bombs?\b/i,
  /\bmethamphetamine\b/i,
  /\b(?:make|cook|produce|manufacture)\s+(?:meth|crack|heroin|fentanyl)/i,
  /\bsynthesize?\s+(?:drugs?|narcotics?)/i,
  /\bsuicide\s+method/i,
  /\bhow\s+to\s+(?:kill|murder)\b/i,
]

// URL and email patterns — simple and correct, no library needed
const URL_EMAIL_PATTERNS: RegExp[] = [
  /https?:\/\/\S+/i,
  /www\.\S+/i,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
]

const runPatterns = (
  text: string,
  patterns: RegExp[],
  category: BlocklistMatch['category'],
): BlocklistMatch[] => {
  const matches: BlocklistMatch[] = []
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const matched = match?.[0]
    if (matched !== undefined) {
      matches.push({ category, matched })
    }
  }
  return matches
}

export const scanOutput = (text: string): BlocklistResult => {
  const matches: BlocklistMatch[] = []
  const seen = new Set<string>()
  const add = (category: BlocklistMatch['category'], matched: string): void => {
    const key = `${category} ${matched}`
    if (seen.has(key)) return
    seen.add(key)
    matches.push({ category, matched })
  }

  // Canonicalisation pre-filter (6.5.1): a throwaway scan copy with homoglyphs
  // folded, zero-width chars stripped, emoji de-emojified and leetspeak undone,
  // so look-alike/invisible evasions can't slip past the matchers below. The
  // keyword layers run on BOTH the raw text (preserving obscenity's own
  // leet/confusable handling) and the canonical copy (adding the new coverage).
  const canonical = canonicaliseForScan(text)

  // Profanity + explicit content (obscenity library — handles leet-speak,
  // unicode confusables, and has built-in false-positive whitelists)
  for (const source of [text, canonical]) {
    for (const m of matcher.getAllMatches(source)) {
      add('profanity', source.slice(m.startIndex, m.endIndex + 1))
    }
  }

  // Dangerous content (custom regex — domain-specific)
  for (const source of [text, canonical]) {
    for (const m of runPatterns(source, DANGEROUS_PATTERNS, 'dangerous')) {
      add(m.category, m.matched)
    }
  }

  // URLs and emails (custom regex) — raw text only; canonicalisation rewrites
  // digits/symbols and would corrupt URLs, emails and phone numbers.
  for (const m of runPatterns(text, URL_EMAIL_PATTERNS, 'contact-info')) {
    add(m.category, m.matched)
  }

  // Phone numbers (libphonenumber-js — proper parsing, ignores postcodes
  // and scientific numbers that greedy regex would false-positive on)
  const phoneMatches = findPhoneNumbersInText(text, 'GB')
  for (const phone of phoneMatches) {
    add('contact-info', text.slice(phone.startsAt, phone.endsAt))
  }

  return {
    blocked: matches.length > 0,
    matches,
  }
}
