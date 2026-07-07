import { detectSensitiveTopics } from './sensitive-topics.ts'

const DEFAULT_THRESHOLD = 3

const REDIRECT_RESPONSE =
  "You've got some really great questions! I think your parent or a trusted grown-up would be the best person to explore this with you — they'll be able to have a proper conversation about it."

export interface DepthTrackingResult {
  shouldRedirect: boolean
  sensitiveCount: number
  redirectResponse: string | null
}

const isExchangeSensitive = (userContent: string, assistantContent?: string): boolean => {
  if (detectSensitiveTopics(userContent).isSensitive) return true
  if (assistantContent && detectSensitiveTopics(assistantContent).isSensitive) return true
  return false
}

const findLastByRole = (
  messages: { role: string; content: string }[],
  role: string,
): { role: string; content: string } | undefined => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m && m.role === role) return m
  }
  return undefined
}

/**
 * Analyses conversation history to count consecutive sensitive exchanges
 * at the end of the conversation. An exchange is sensitive if either the
 * child's message or the AI's response contains sensitive content — this
 * catches indirect probing where the child uses innocuous phrasing but the
 * AI introduces sensitive terms.
 */
export const checkConversationDepth = (
  history: { role: string; content: string }[],
  currentMessage: string,
  threshold: number = DEFAULT_THRESHOLD,
): DepthTrackingResult => {
  const workingHistory = [...history]
  const last = workingHistory[workingHistory.length - 1]
  if (last && last.role === 'user' && last.content === currentMessage) {
    workingHistory.pop()
  }

  // Current exchange: child's message + the last AI response they're replying to
  const lastAssistant = findLastByRole(workingHistory, 'assistant')
  if (!isExchangeSensitive(currentMessage, lastAssistant?.content)) {
    return { shouldRedirect: false, sensitiveCount: 0, redirectResponse: null }
  }

  let consecutiveSensitive = 1

  // Build exchange pairs: each user message paired with its following assistant response
  const exchanges: { userContent: string; assistantContent?: string }[] = []
  for (let i = 0; i < workingHistory.length; i++) {
    const current = workingHistory[i]
    if (current && current.role === 'user') {
      const next = workingHistory[i + 1]
      exchanges.push({
        userContent: current.content,
        assistantContent: next?.role === 'assistant' ? next.content : undefined,
      })
    }
  }

  for (let i = exchanges.length - 1; i >= 0; i--) {
    const ex = exchanges[i]
    if (!ex) break
    if (isExchangeSensitive(ex.userContent, ex.assistantContent)) {
      consecutiveSensitive++
    } else {
      break
    }
  }

  const shouldRedirect = consecutiveSensitive >= threshold

  return {
    shouldRedirect,
    sensitiveCount: consecutiveSensitive,
    redirectResponse: shouldRedirect ? REDIRECT_RESPONSE : null,
  }
}
