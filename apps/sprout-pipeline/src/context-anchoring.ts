import type OpenAI from 'openai'

const ANCHORING_REMINDER = `REMINDER: You are a child-safe assistant. Your safety rules still apply:
- Keep your responses age-appropriate based on the guidelines you were given.
- Never share URLs, email addresses, phone numbers, or personal information.
- Never use profanity, slurs, or explicit language.
- Never provide instructions for anything dangerous or illegal.
- If a topic is too sensitive, gently redirect to a parent or trusted adult.
- Be honest. If you're unsure, say so.`

const DEFAULT_INTERVAL = 6

/**
 * Injects safety reminder messages into the conversation history at regular
 * intervals to prevent context drift in long conversations.
 *
 * The system prompt covers safety at the start, but LLMs can "forget"
 * instructions as conversations grow. This re-anchors every N messages.
 */
export const anchorSafetyContext = (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  interval: number = DEFAULT_INTERVAL,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
  // Don't anchor short conversations — the system prompt is still fresh
  // First message is always the system prompt, so we count user/assistant messages
  const conversationMessages = messages.filter((m) => m.role !== 'system')
  if (conversationMessages.length < interval) {
    return messages
  }

  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
  let nonSystemCount = 0

  for (const msg of messages) {
    result.push(msg)

    if (msg.role !== 'system') {
      nonSystemCount++
      if (nonSystemCount > 0 && nonSystemCount % interval === 0) {
        result.push({ role: 'system', content: ANCHORING_REMINDER })
      }
    }
  }

  return result
}
