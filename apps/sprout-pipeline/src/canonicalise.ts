/**
 * Canonicalisation pre-filter (Phase 6.5.1, ADR-0004).
 *
 * Produces a throwaway *scan copy* of a message with the cheapest evasions
 * folded out — NFKC normalisation, zero-width stripping, emoji-to-word
 * substitution, homoglyph/confusable folding, and de-leeting — so the blocklist
 * cannot be slipped past with look-alike characters or invisible separators.
 *
 * This NEVER mutates the stored child or AI message: callers pass the original
 * text and scan the returned copy. NFKC + confusable folding are deliberately
 * lossy (accents, maths notation) and would corrupt legitimate input if applied
 * to stored text — which is exactly why this is scan-copy-only.
 */

import { remove as foldConfusables } from 'confusables'

// Zero-width and invisible formatting characters used to split words so a
// literal/regex matcher sees "sh<zwsp>it" instead of "shit": ZWSP, ZWNJ, ZWJ,
// word joiner, BOM/ZWNBSP, soft hyphen, Mongolian vowel separator.
const ZERO_WIDTH = /\u200B|\u200C|\u200D|\u2060|\uFEFF|\u00AD|\u180E/g

// Safety-relevant emoji mapped to the word they commonly stand in for, so an
// emoji substituted for a blocked word ("make a 💣") is seen as text.
const EMOJI_WORDS: Record<string, string> = {
  '💣': 'bomb',
  '🔫': 'gun',
  '🔪': 'knife',
  '💊': 'drugs',
  '💉': 'drugs',
  '🚬': 'cigarette',
  '🍺': 'alcohol',
  '🍻': 'alcohol',
  '🍷': 'alcohol',
  '🍸': 'alcohol',
  '🥃': 'alcohol',
  '👶': 'baby',
}

// Classic leetspeak digit/symbol → letter substitutions. Applied only to the
// scan copy, after confusable folding, and only to characters adjacent to a
// letter, so "b0mb" reads as "bomb" while standalone numbers ("I scored 100")
// are left intact.
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
}

const demojize = (text: string): string => {
  let out = text
  for (const [emoji, word] of Object.entries(EMOJI_WORDS)) {
    out = out.split(emoji).join(` ${word} `)
  }
  return out
}

// Only substitute a leet character that sits next to an ASCII letter, so it
// disguises a word rather than appearing in ordinary numeric text.
const deLeet = (text: string): string =>
  text.replace(/(?<=[a-z])[013457@$!]|[013457@$!](?=[a-z])/gi, (char) => LEET[char] ?? char)

export const canonicaliseForScan = (text: string): string => {
  const nfkc = text.normalize('NFKC')
  const withoutZeroWidth = nfkc.replace(ZERO_WIDTH, '')
  const demojized = demojize(withoutZeroWidth)
  // confusables: folds homoglyphs (Cyrillic о → o) and strips accents.
  const folded = foldConfusables(demojized)
  const deLeeted = deLeet(folded)
  return deLeeted.replace(/\s+/g, ' ').trim()
}
