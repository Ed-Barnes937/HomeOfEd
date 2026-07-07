/**
 * R3 — purpose-built safety classifier (Phase 6.5.2, ADR-0003).
 *
 * The second opinion on an output: Llama Guard 3 (8B) via OpenRouter, trained on
 * a safety taxonomy rather than asked to reason like the gpt-4.1-nano judge
 * (R5). It is another hosted API call on infra we already use — no new sidecar,
 * unlike the self-hosted ShieldGemma/Detoxify alternatives (~$0.18/M tok).
 *
 * Like the R5 judge it is a non-deterministic network call needing an API key,
 * so it runs in the pipeline but is excluded from the CI eval harness (6.5.3) —
 * only the deterministic R2 blocklist, sensitive-topic detector, depth tracker,
 * and the R4 lexical classifier gate CI.
 *
 * Fail-closed: any error or unparseable verdict is treated as unsafe, matching
 * the R5 judge's fail-safe bias. For a children's product a wrongly-blocked
 * answer is cheaper than a wrongly-passed one.
 */

import type OpenAI from 'openai'

export interface SafetyClassifierResult {
  safe: boolean
  /** Llama Guard hazard category codes (e.g. S1, S11), when unsafe. */
  categories: string[]
  reason: string
}

// Llama Guard 4 12B on OpenRouter. The model is chat-templated by the provider:
// we pass the conversation turns and it classifies the final (assistant) turn,
// returning "safe" or "unsafe\n<comma-separated category codes>". (Guard 3 8B
// was retired from OpenRouter — "No endpoints found" 404 — and Guard 4 is the
// drop-in successor: same MLCommons S-code taxonomy, same output format.)
const LLAMA_GUARD_MODEL = 'meta-llama/llama-guard-4-12b'

export const parseLlamaGuardResponse = (response: string): SafetyClassifierResult => {
  const trimmed = response.trim()
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim().toLowerCase() ?? ''

  if (firstLine === 'safe') {
    return { safe: true, categories: [], reason: 'Llama Guard: safe' }
  }

  if (firstLine.startsWith('unsafe')) {
    // Llama Guard 3 normally returns the codes on the line after "unsafe", but
    // tolerate same-line variants ("unsafe S1") too. Collect S-codes from the
    // whole response so the parent-facing reason keeps the category.
    const categories = [...trimmed.matchAll(/\bS\d+\b/gi)].map((m) => (m[0] ?? '').toUpperCase())
    return {
      safe: false,
      categories,
      reason: `Llama Guard flagged unsafe${categories.length ? `: ${categories.join(', ')}` : ''}`,
    }
  }

  // Unparseable → fail closed (unsafe), consistent with the R5 judge.
  return {
    safe: false,
    categories: [],
    reason: `Llama Guard returned unparseable response: "${trimmed.slice(0, 100)}"`,
  }
}

export const classifyWithLlamaGuard = async (
  openai: OpenAI,
  childMessage: string,
  aiResponse: string,
): Promise<SafetyClassifierResult> => {
  try {
    const completion = await openai.chat.completions.create({
      model: LLAMA_GUARD_MODEL,
      messages: [
        { role: 'user', content: childMessage },
        { role: 'assistant', content: aiResponse },
      ],
      max_tokens: 50,
      temperature: 0,
    })

    const content = completion.choices[0]?.message?.content ?? ''
    return parseLlamaGuardResponse(content)
  } catch (err) {
    console.error('Llama Guard error:', err)
    // Fail-safe: if the classifier call fails, treat as unsafe.
    return {
      safe: false,
      categories: [],
      reason: 'Llama Guard call failed',
    }
  }
}
