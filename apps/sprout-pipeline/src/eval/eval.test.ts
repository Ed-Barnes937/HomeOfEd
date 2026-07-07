import { describe, expect, it } from 'vitest'

import { runTrickSet, summarise, formatSummary } from './harness.ts'
import { TRICK_CASES } from './trick-set.ts'

/**
 * The per-case `expected` flags in trick-set.ts are the committed baseline and
 * the ratchet: every case's actual outcome must equal its `expected`. That makes
 * "a regression fails the build" precise (it names the case) and self-maintaining
 * (adding a documented bypass updates the baseline with it — no magic threshold).
 * The aggregate bypass rate is reported to the CI log so the metric is tracked.
 */
const results = runTrickSet(TRICK_CASES)
const summary = summarise(results)

describe('adversarial guardrail eval (6.5.3)', () => {
  it('reports the bypass rate', () => {
    console.log('\n' + formatSummary(summary) + '\n')
    expect(summary.total).toBeGreaterThan(0)
  })

  it('has unique, stable case ids', () => {
    const ids = TRICK_CASES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has no regressions (a previously-caught attack now bypasses)', () => {
    const ids = summary.regressions.map((r) => r.testCase.id)
    expect(ids, `Regressions — these must stay caught: ${ids.join(', ')}`).toEqual([])
  })

  it('has an up-to-date baseline (a known bypass is now caught — record it)', () => {
    const ids = summary.staleBaselines.map((r) => r.testCase.id)
    expect(
      ids,
      `Now caught — flip "expected" to "caught" in trick-set.ts: ${ids.join(', ')}`,
    ).toEqual([])
  })
})
