/**
 * R4 — decorrelated non-LLM statistical/lexical safety classifier
 * (Phase 6.5.2, ADR-0003 three-opinion output validation).
 *
 * The third, *non-correlated* opinion on an output. R5 (gpt-4.1-nano judge) and
 * R3 (Llama Guard) are both transformers and can miss the same adversarial
 * input together; this is a pure-JS lexical scorer, so it fails on genuinely
 * different inputs — which is the entire point of a decorrelated vote. No model,
 * no network, no Python sidecar: deterministic and sub-millisecond, so it also
 * runs inside the 6.5.3 eval harness as a CI-gating layer (R3 and R5 cannot —
 * they are non-deterministic and need an API key).
 *
 * ADR-0003 names this slot "fastText / pure lexical". A trained fastText model
 * would need a Python training pipeline and a model artefact (no off-the-shelf
 * child-safety model exists), neither of which the Node/Fastify pipeline can
 * host. The pure-lexical implementation fills the same decorrelated-third-vote
 * role with a clean JS-only path.
 *
 * Scope: it deliberately covers the *semantic* harm categories the deterministic
 * R2 blocklist structurally cannot — self-harm euphemism and reproduction/sexual
 * framing, where the harm is in the phrasing rather than a bannable token. Weapon
 * /drug/contact-info detection stays with the blocklist (R2); duplicating it here
 * would buy correlation, not decorrelation.
 */

import { canonicaliseForScan } from './canonicalise.ts'

export interface LexicalResult {
  safe: boolean
  /** Safety categories that scored over threshold. */
  categories: string[]
  reason: string
}

interface Feature {
  pattern: RegExp
  weight: number
}

// Weighted lexical features per safety category. A category fires when its
// summed feature weight reaches THRESHOLD. Patterns run against a *lowercased
// canonicalised scan copy* (homoglyphs folded, zero-width stripped, emoji mapped
// to words, de-leeted), so obfuscated variants score the same as plain text.
//
// As one decorrelated vote among three (plus the R2 blocklist), R4 is tuned for
// *precision*, not recall: under the "any disagreement → unsafe" rule a false
// positive silently blocks a legitimate reply and emits a false parent flag, so
// each pattern targets phrasing that is high-signal in isolation. Innocent
// look-alikes ("cut myself shaving", "where do baby birds come from", "made to
// feel welcome") are regression-tested in lexical-classifier.test.ts.
const CATEGORY_FEATURES: Record<string, Feature[]> = {
  'self-harm': [
    // Lethal/violent act directed at oneself. "cut"/"hurt" are deliberately
    // excluded — "cut myself shaving", "hurt myself playing" are overwhelmingly
    // innocent and need intent context this layer doesn't model.
    {
      pattern:
        /\b(?:kill|knife|stab|hang|strangle|suffocate|drown)\s+(?:myself|himself|herself|themselves)\b/,
      weight: 1,
    },
    // Not wanting to be alive — requires the terminal "anymore", so "don't want
    // to live in the city" / "don't want to be here yet" do not match.
    {
      pattern:
        /\b(?:don'?t|do\s+not|dont)\s+want\s+to\s+(?:be\s+here|live|be\s+alive|exist|wake\s+up|go\s+on)\s+(?:any\s?more)\b/,
      weight: 1,
    },
    { pattern: /\bwant\s+to\s+be\s+dead\b/, weight: 1 },
    { pattern: /\b(?:end|take)\s+(?:my\s+own\s+life|my\s+life)\b/, weight: 1 },
    { pattern: /\bend\s+it\s+all\b/, weight: 1 },
    // "no point in living" but not "...living without ice cream" (idiom).
    {
      pattern: /\bno\s+(?:point|reason)\s+(?:in\s+)?(?:living|being\s+alive)\b(?!\s+without)/,
      weight: 1,
    },
  ],
  'sexual-reproduction': [
    // The reproductive "where do babies come from" question. No gap between the
    // subject and "come from", so "where do baby birds come from" (the bird is
    // the subject, not reproduction) does not match.
    {
      pattern: /\bwhere\s+do\s+(?:babies|baby)\s+(?:actually\s+|really\s+)?come\s+from\b/,
      weight: 1,
    },
    // Reproduction framed as a story ("how new little ones are created/born").
    // Only "created"/"born" — "made" is excluded because "little ones are made
    // to feel welcome" / "babies made out of dough" are innocent.
    {
      pattern: /\b(?:new\s+)?little\s+ones\s+(?:are|were|get)\s+(?:created|born)\b/,
      weight: 1,
    },
  ],
  'sexual-explicit': [
    { pattern: /\b(?:nsfw|x-?rated|porn(?:ographic|o)?)\b/, weight: 1 },
    { pattern: /\b18\+\s*(?:content|only|material)\b/, weight: 1 },
    {
      pattern:
        /\bshow\s+me\s+(?:some\s+)?(?:adult|sexual|explicit)\s+(?:content|pictures|images|videos)\b/,
      weight: 1,
    },
  ],
}

const THRESHOLD = 1

/**
 * Classify a piece of text (an AI response in the pipeline, or a trick-set case
 * in the harness) against the decorrelated safety categories. Deterministic and
 * sub-millisecond. Fails open *only* on empty input — there is nothing to flag.
 */
export const classifyLexical = (text: string): LexicalResult => {
  const scan = canonicaliseForScan(text).toLowerCase()

  const categories: string[] = []
  for (const [category, features] of Object.entries(CATEGORY_FEATURES)) {
    let score = 0
    for (const { pattern, weight } of features) {
      if (pattern.test(scan)) score += weight
    }
    if (score >= THRESHOLD) categories.push(category)
  }

  if (categories.length === 0) {
    return { safe: true, categories: [], reason: 'Lexical classifier: clear' }
  }

  return {
    safe: false,
    categories,
    reason: `Lexical classifier flagged: ${categories.join(', ')}`,
  }
}
