/**
 * Whole-conversation crescendo check (Phase 6.5.5).
 *
 * The per-turn sensitive-topic detector and the consecutive-sensitive depth
 * counter (depth-tracking.ts) both go quiet when an adversary spreads a harmful
 * goal across several individually-innocuous turns ("what pills are in the
 * cabinet?" → "how many in a box?" → "what if someone took a whole lot at
 * once?"). No single turn trips a detector, so the depth counter never moves.
 *
 * This check evaluates the *running conversation as a whole* each turn: it looks
 * for soft signals that are harmless alone but concerning together — a context
 * signal (e.g. medicines) plus a harmful-escalation signal (e.g. an overdose)
 * co-occurring across the conversation — and flags the build-up before the depth
 * threshold would notice.
 *
 * Deterministic and non-LLM, so it runs in the 6.5.3 eval harness as a CI-gating
 * layer. Like the other scan layers it works on a canonicalised copy (6.5.1).
 *
 * Tuned hard for precision, because a hit hard-redirects the child. Two rules:
 *   - Only child turns are scanned, never the assistant's — the model correctly
 *     names these terms when giving safety guidance ("taking too many pills can
 *     cause an overdose"), and that must not self-trip the check on the next turn.
 *   - The escalation signal must name an explicit substance ("a whole lot of
 *     paracetamol") or the word "overdose" — never a bare anaphor ("a whole lot
 *     of them at once"). An anaphoric quantity phrase is lexically identical
 *     between a real overdose question and innocent talk ("a whole lot of them"
 *     about trading cards), so resolving it needs the meaning of the reference,
 *     not a pattern. That case is deferred to the LLM crescendo judge.
 */

import { canonicaliseForScan } from './canonicalise.ts'

export interface CrescendoResult {
  detected: boolean
  /** The crescendo category that fired, if any. */
  category: string | null
  redirectResponse: string | null
}

const REDIRECT_RESPONSE =
  "That's a really important question, and it sounds like something worth talking through properly. Your parent or a trusted grown-up would be the best person to help you with this."

interface CrescendoCategory {
  name: string
  /** Soft context signal — harmless on its own. */
  context: RegExp
  /** Harmful escalation signal — the direction the build-up is heading. */
  escalation: RegExp
}

const CATEGORIES: CrescendoCategory[] = [
  {
    // Medicines / substances established as context + an explicit overdose
    // escalation (a named substance in quantity, or the word "overdose").
    name: 'self-harm-overdose',
    context:
      /\b(?:pills?|tablets?|medicines?|medication|paracetamol|ibuprofen|aspirin|painkillers?|pain\s+killers?|capsules?|cabinet)\b/,
    escalation:
      /\boverdose[ds]?\b|\b(?:took|take|takes|taking|taken|swallow(?:ed|s)?|had|downed?)\b[^.?!]{0,40}\b(?:whole\s+lot|too\s+many|a\s+lot|lots|bunch|loads|handful)\b[^.?!]{0,20}\bof\s+(?:pills?|tablets?|medicines?|medication|paracetamol|ibuprofen|aspirin|painkillers?|pain\s+killers?|capsules?)\b/,
  },
]

const buildTranscript = (
  history: { role: string; content: string }[],
  currentMessage: string,
): string => {
  // Callers sometimes include the current turn as the last history entry; drop
  // the duplicate so it isn't scanned twice (mirrors depth-tracking.ts).
  const workingHistory = [...history]
  const last = workingHistory[workingHistory.length - 1]
  if (last && last.role === 'user' && last.content === currentMessage) {
    workingHistory.pop()
  }

  // Scan only child turns + the current message. The crescendo threat model is
  // child-driven escalation; the model's own safety guidance ("taking too many
  // pills can cause an overdose") legitimately names these terms, and scanning
  // assistant turns would let a correct warning self-trip the check on the
  // child's next turn.
  const parts = [
    ...workingHistory.filter((m) => m.role === 'user').map((m) => m.content),
    currentMessage,
  ]
  // Join with sentence separators so each turn is its own clause — the
  // escalation pattern's internal [^.?!] guards then can't span two turns.
  return canonicaliseForScan(parts.join('. ')).toLowerCase()
}

/**
 * Evaluate the running conversation for a slow-build crescendo. `currentMessage`
 * is the child's latest turn; `history` is the prior turns (both roles).
 */
export const checkCrescendo = (
  history: { role: string; content: string }[],
  currentMessage: string,
): CrescendoResult => {
  const transcript = buildTranscript(history, currentMessage)

  for (const category of CATEGORIES) {
    if (category.context.test(transcript) && category.escalation.test(transcript)) {
      return {
        detected: true,
        category: category.name,
        redirectResponse: REDIRECT_RESPONSE,
      }
    }
  }

  return { detected: false, category: null, redirectResponse: null }
}
