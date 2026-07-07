import { describe, expect, it } from 'vitest'
import type OpenAI from 'openai'

import { anchorSafetyContext } from './context-anchoring.ts'

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam

const system = (content: string): Msg => ({ role: 'system', content })
const user = (content: string): Msg => ({ role: 'user', content })
const assistant = (content: string): Msg => ({ role: 'assistant', content })

describe('anchorSafetyContext', () => {
  it('does not modify short conversations', () => {
    const messages: Msg[] = [system('You are helpful.'), user('Hi'), assistant('Hello!')]
    const result = anchorSafetyContext(messages)
    expect(result).toEqual(messages)
  })

  it('injects a safety reminder after every N non-system messages', () => {
    const messages: Msg[] = [
      system('You are helpful.'),
      user('msg 1'),
      assistant('reply 1'),
      user('msg 2'),
      assistant('reply 2'),
      user('msg 3'),
      assistant('reply 3'), // 6th non-system message
    ]
    const result = anchorSafetyContext(messages, 6)
    expect(result.length).toBe(messages.length + 1)
    // The injected message should be a system message after the 6th non-system msg
    const injected = result[7] // index 7 = after 6 non-system + 1 original system
    expect(injected?.role).toBe('system')
    expect((injected?.content as string).toLowerCase()).toMatch(/reminder/)
  })

  it('injects multiple reminders in long conversations', () => {
    const messages: Msg[] = [system('You are helpful.')]
    for (let i = 0; i < 12; i++) {
      messages.push(i % 2 === 0 ? user(`msg ${i}`) : assistant(`reply ${i}`))
    }
    const result = anchorSafetyContext(messages, 6)
    const injected = result.filter(
      (m) => m.role === 'system' && (m.content as string).includes('REMINDER'),
    )
    expect(injected.length).toBe(2)
  })

  it('preserves the original message order', () => {
    const messages: Msg[] = [
      system('System prompt'),
      user('first'),
      assistant('reply1'),
      user('second'),
      assistant('reply2'),
      user('third'),
      assistant('reply3'),
    ]
    const result = anchorSafetyContext(messages, 6)
    // Filter out injected reminders
    const withoutReminders = result.filter(
      (m) => !(m.role === 'system' && (m.content as string).includes('REMINDER')),
    )
    expect(withoutReminders).toEqual(messages)
  })

  it('uses default interval of 6 when not specified', () => {
    const messages: Msg[] = [system('System prompt')]
    // Add exactly 6 non-system messages
    for (let i = 0; i < 6; i++) {
      messages.push(i % 2 === 0 ? user(`u${i}`) : assistant(`a${i}`))
    }
    const result = anchorSafetyContext(messages)
    expect(result.length).toBe(messages.length + 1)
  })
})
