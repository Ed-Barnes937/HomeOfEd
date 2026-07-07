/**
 * Adversarial eval harness (Phase 6.5.3).
 *
 * Runs the trick set against the pipeline's *deterministic* guardrails and
 * reports a bypass rate. A case is "caught" if any deterministic layer flags
 * it — mirroring the pipeline's defence-in-depth, where any layer can block or
 * flag. The LLM opinions (R5 gpt-4.1-nano judge and R3 Llama Guard) are excluded
 * by design — both need a key and are non-deterministic, so they cannot gate CI.
 * The R4 lexical classifier (6.5.2), the prompt-injection shield (6.5.7), and
 * the whole-conversation crescendo check (6.5.5) are non-LLM and deterministic,
 * so they *do* run here as CI-gating layers.
 */

import { scanOutput } from '../blocklist.ts'
import { checkCrescendo } from '../crescendo.ts'
import { checkConversationDepth } from '../depth-tracking.ts'
import { classifyLexical } from '../lexical-classifier.ts'
import { detectPromptInjection } from '../prompt-injection.ts'
import { detectSensitiveTopics } from '../sensitive-topics.ts'
import type { TrickCase } from './trick-set.ts'

export interface CaseResult {
  testCase: TrickCase
  caught: boolean
  /** Which deterministic layer(s) flagged the case, if any. */
  caughtBy: string[]
  /** Expected "caught" but slipped through — a genuine regression. */
  regression: boolean
  /** Expected "bypass" but now caught — the baseline needs updating (a win). */
  staleBaseline: boolean
}

export interface EvalSummary {
  total: number
  caught: number
  bypassed: number
  /** bypassed / total, in [0, 1]. */
  bypassRate: number
  byTechnique: Record<string, { total: number; bypassed: number }>
  regressions: CaseResult[]
  staleBaselines: CaseResult[]
  results: CaseResult[]
}

/** Run every deterministic guardrail layer against one case. */
export const runDeterministicGuardrails = (
  testCase: TrickCase,
): { caught: boolean; caughtBy: string[] } => {
  const caughtBy: string[] = []

  if (scanOutput(testCase.input).blocked) {
    caughtBy.push('blocklist')
  }
  if (detectSensitiveTopics(testCase.input).isSensitive) {
    caughtBy.push('sensitive-topics')
  }
  // R4 runs on both paths in the pipeline (like the R2 blocklist): on the child
  // input as a sensitive-topic signal (index.ts Step 1) and on the model output
  // in the three-opinion vote (Step 6). So scoring it on the case text here
  // matches production on either path.
  if (!classifyLexical(testCase.input).safe) {
    caughtBy.push('lexical-classifier')
  }
  // Prompt-injection shield (6.5.7) — deterministic input-stage detector that
  // blocks instruction-override / fake-system / persona-jailbreak attempts
  // before generation (index.ts Step 0b).
  if (detectPromptInjection(testCase.input).detected) {
    caughtBy.push('prompt-injection')
  }
  if (testCase.history) {
    if (checkConversationDepth(testCase.history, testCase.input).shouldRedirect) {
      caughtBy.push('depth-tracking')
    }
    // Whole-conversation crescendo check (6.5.5) — catches a slow multi-turn
    // build-up that stays under the per-turn detector and depth counter
    // (index.ts Step 1c).
    if (checkCrescendo(testCase.history, testCase.input).detected) {
      caughtBy.push('crescendo')
    }
  }

  return { caught: caughtBy.length > 0, caughtBy }
}

export const runTrickSet = (cases: TrickCase[]): CaseResult[] =>
  cases.map((testCase) => {
    const { caught, caughtBy } = runDeterministicGuardrails(testCase)
    return {
      testCase,
      caught,
      caughtBy,
      regression: testCase.expected === 'caught' && !caught,
      staleBaseline: testCase.expected === 'bypass' && caught,
    }
  })

export const summarise = (results: CaseResult[]): EvalSummary => {
  const total = results.length
  const bypassed = results.filter((r) => !r.caught).length

  const byTechnique: EvalSummary['byTechnique'] = {}
  for (const r of results) {
    const tech = r.testCase.technique
    byTechnique[tech] ??= { total: 0, bypassed: 0 }
    byTechnique[tech].total += 1
    if (!r.caught) byTechnique[tech].bypassed += 1
  }

  return {
    total,
    caught: total - bypassed,
    bypassed,
    bypassRate: total === 0 ? 0 : bypassed / total,
    byTechnique,
    regressions: results.filter((r) => r.regression),
    staleBaselines: results.filter((r) => r.staleBaseline),
    results,
  }
}

const pct = (rate: number): string => `${(rate * 100).toFixed(1)}%`

/** Human-readable summary for the CI log. */
export const formatSummary = (summary: EvalSummary): string => {
  const lines: string[] = []
  lines.push('Adversarial guardrail eval — bypass report')
  lines.push('==========================================')
  lines.push(
    `Total: ${summary.total}  Caught: ${summary.caught}  Bypassed: ${summary.bypassed}  Bypass rate: ${pct(summary.bypassRate)}`,
  )
  lines.push('')
  lines.push('By technique:')
  for (const [tech, stat] of Object.entries(summary.byTechnique)) {
    lines.push(`  ${tech.padEnd(20)} ${stat.bypassed}/${stat.total} bypassed`)
  }

  const bypassing = summary.results.filter((r) => !r.caught)
  if (bypassing.length > 0) {
    lines.push('')
    lines.push('Currently bypassing:')
    for (const r of bypassing) {
      lines.push(`  [${r.testCase.expected}] ${r.testCase.id} — ${r.testCase.description}`)
    }
  }

  return lines.join('\n')
}
