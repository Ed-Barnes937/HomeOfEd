import { describe, expect, it } from 'vitest'

import { checkConversationDepth } from './depth-tracking.ts'

describe('checkConversationDepth', () => {
  it('does not redirect for non-sensitive messages', () => {
    const result = checkConversationDepth([], 'What is the biggest planet?')
    expect(result.shouldRedirect).toBe(false)
    expect(result.sensitiveCount).toBe(0)
  })

  it('does not redirect for a single sensitive message', () => {
    const result = checkConversationDepth([], 'What happens when you die?')
    expect(result.shouldRedirect).toBe(false)
    expect(result.sensitiveCount).toBe(1)
  })

  it('does not redirect below threshold', () => {
    const history = [
      { role: 'user', content: 'What happens when you die?' },
      { role: 'assistant', content: 'When someone dies...' },
    ]
    const result = checkConversationDepth(history, 'But what about heaven?', 3)
    // Current message is sensitive (death), one previous sensitive = 2 total
    expect(result.shouldRedirect).toBe(false)
    expect(result.sensitiveCount).toBe(2)
  })

  it('redirects when threshold is reached', () => {
    const history = [
      { role: 'user', content: 'What happens when you die?' },
      { role: 'assistant', content: 'When someone dies...' },
      { role: 'user', content: 'Does dying hurt?' },
      { role: 'assistant', content: 'Different people believe...' },
    ]
    const result = checkConversationDepth(history, 'Will I die too?', 3)
    expect(result.shouldRedirect).toBe(true)
    expect(result.sensitiveCount).toBe(3)
    expect(result.redirectResponse).toBeTruthy()
    expect(result.redirectResponse?.toLowerCase()).toMatch(/parent|grown-up/)
  })

  it('resets count when a non-sensitive message breaks the chain', () => {
    const history = [
      { role: 'user', content: 'What happens when you die?' },
      { role: 'assistant', content: 'When someone dies...' },
      { role: 'user', content: 'What colour is the sky?' }, // breaks the chain
      { role: 'assistant', content: 'The sky is blue!' },
      { role: 'user', content: 'Tell me more about death' },
      { role: 'assistant', content: 'Well...' },
    ]
    const result = checkConversationDepth(history, 'What about funerals?', 3)
    // Only 2 consecutive sensitive (the last history user msg + current)
    expect(result.shouldRedirect).toBe(false)
    expect(result.sensitiveCount).toBe(2)
  })

  it('counts exchanges where user messages are sensitive regardless of assistant content', () => {
    const history = [
      { role: 'user', content: 'What happens when you die?' },
      { role: 'assistant', content: 'Death is a natural part of life...' },
      { role: 'user', content: 'Does dying hurt?' },
      { role: 'assistant', content: "That's a thoughtful question..." },
    ]
    const result = checkConversationDepth(history, 'Will my dog die?', 3)
    expect(result.shouldRedirect).toBe(true)
    expect(result.sensitiveCount).toBe(3)
  })

  it('treats exchange as sensitive when only the AI response contains sensitive terms', () => {
    const history = [
      { role: 'user', content: 'Tell me more about that' },
      {
        role: 'assistant',
        content: "This process is called sexual intercourse, and it's how babies are made.",
      },
    ]
    const result = checkConversationDepth(history, 'What happens next?')
    // Neither user message is sensitive, but the assistant response
    // mentions "sexual" → both exchanges are sensitive
    expect(result.sensitiveCount).toBe(2)
  })

  it('redirects when AI responses create a sensitive chain despite innocuous child messages', () => {
    const history = [
      { role: 'user', content: 'How are babys made?' },
      {
        role: 'assistant',
        content: 'A baby is made when cells join together during pregnancy.',
      },
      { role: 'user', content: 'Tell me more about that' },
      {
        role: 'assistant',
        content: 'During sexual reproduction, a sperm cell meets an egg cell.',
      },
    ]
    const result = checkConversationDepth(history, 'What happens next?', 3)
    // Child messages are all innocuous (typo dodges regex, follow-ups generic)
    // but each AI response mentions pregnancy / sexual → all 3 exchanges sensitive
    expect(result.shouldRedirect).toBe(true)
    expect(result.sensitiveCount).toBe(3)
  })

  it('breaks the chain when neither party mentions sensitive content', () => {
    const history = [
      { role: 'user', content: 'Tell me about pregnancy' },
      { role: 'assistant', content: 'Pregnancy is when a baby grows...' },
      { role: 'user', content: 'What is the biggest planet?' },
      { role: 'assistant', content: 'Jupiter is the biggest planet!' },
      { role: 'user', content: 'Tell me more about that' },
      {
        role: 'assistant',
        content: 'This is called sexual reproduction.',
      },
    ]
    const result = checkConversationDepth(history, 'What happens next?', 3)
    // Exchange 3 + current are sensitive, but exchange 2 (Jupiter) breaks the chain
    expect(result.shouldRedirect).toBe(false)
    expect(result.sensitiveCount).toBe(2)
  })

  it('does not double-count when history includes the current message', () => {
    // The web app includes the current message in history — the function
    // must deduplicate to avoid inflating the count.
    const currentMessage = 'Does dying hurt?'
    const history = [
      { role: 'user', content: 'What happens when you die?' },
      { role: 'assistant', content: 'When someone dies...' },
      { role: 'user', content: currentMessage }, // duplicate of currentMessage
    ]
    const result = checkConversationDepth(history, currentMessage, 3)
    // Should be 2 (previous sensitive + current), NOT 3
    expect(result.shouldRedirect).toBe(false)
    expect(result.sensitiveCount).toBe(2)
  })

  it('uses default threshold of 3', () => {
    const history = [
      { role: 'user', content: 'What happens when you die?' },
      { role: 'assistant', content: '...' },
      { role: 'user', content: 'Does dying hurt?' },
      { role: 'assistant', content: '...' },
    ]
    const result = checkConversationDepth(history, 'Will I die?')
    expect(result.shouldRedirect).toBe(true)
  })
})
