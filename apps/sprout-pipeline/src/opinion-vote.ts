/**
 * Three-opinion output vote (Phase 6.5.2, ADR-0003).
 *
 * Combines the three decorrelated opinions on a model output:
 *   - R5  the gpt-4.1-nano judge (general appropriateness)
 *   - R3  Llama Guard (purpose-built safety classifier)
 *   - R4  the pure-JS lexical classifier (non-LLM, decorrelated)
 *
 * Rule (ADR-0003): **any disagreement is treated as unsafe** → safe fallback.
 * The output is released only when all three opinions agree it is safe; a single
 * dissent blocks it. This is the whole point of decorrelated layers — two
 * independent things must fail before anything reaches a child.
 */

export type OpinionSource = 'judge' | 'llama-guard' | 'lexical'

export interface Opinion {
  source: OpinionSource
  safe: boolean
  reason: string
}

export interface VoteResult {
  safe: boolean
  reason: string
  /** The opinions that voted unsafe (empty when safe). */
  dissenting: Opinion[]
}

export const voteOutputOpinions = (opinions: Opinion[]): VoteResult => {
  const dissenting = opinions.filter((o) => !o.safe)

  if (dissenting.length === 0) {
    return {
      safe: true,
      reason: 'All opinions agree: safe',
      dissenting: [],
    }
  }

  return {
    safe: false,
    reason: dissenting.map((o) => `${o.source}: ${o.reason}`).join(' | '),
    dissenting,
  }
}
