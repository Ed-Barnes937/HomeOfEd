/**
 * Flag-and-forward: when the pipeline detects an issue (validation failure,
 * sensitive topic, or blocklist hit), return a safe fallback response and
 * signal to the caller that a flag should be created.
 *
 * The pipeline service doesn't own the database — it returns flag metadata
 * in the SSE stream for the web app to persist.
 */

export type FlagType = 'sensitive' | 'blocked' | 'validation-failed'

export interface FlagEvent {
  type: FlagType
  reason: string
  topics?: string[]
  childMessage: string
  aiResponse?: string
}

const FALLBACK_RESPONSES: Record<FlagType, string> = {
  sensitive:
    "That's a really important question. I think your parent or a grown-up you trust would be the best person to talk to about this — they'll be able to help you much better than I can.",
  blocked: "I'm not able to help with that one. Try asking your parent or a trusted adult instead.",
  'validation-failed':
    "Hmm, I'm not sure I can give you a good answer to that right now. Try asking your parent — they might be able to help!",
}

export const getFallbackResponse = (flagType: FlagType): string => {
  return FALLBACK_RESPONSES[flagType]
}

export const createFlagEvent = (
  flagType: FlagType,
  reason: string,
  childMessage: string,
  options?: { topics?: string[]; aiResponse?: string },
): FlagEvent => {
  return {
    type: flagType,
    reason,
    childMessage,
    topics: options?.topics,
    aiResponse: options?.aiResponse,
  }
}
