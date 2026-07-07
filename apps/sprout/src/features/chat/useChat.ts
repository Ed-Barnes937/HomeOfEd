import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getSessionLimit } from '../../lib/chatConfig.ts'
import { getChildSession, type ChildSession } from '../../lib/childSession.ts'
import type { PresetSliders } from '../../server/domain/presets.ts'
import { trpcClient } from '../../trpcClient.ts'

export interface ChatMessage {
  role: 'child' | 'ai'
  content: string
  flagged?: boolean
}

interface UseChatOptions {
  conversationId?: string
}

export interface UseChatResult {
  messages: ChatMessage[]
  input: string
  setInput: (value: string) => void
  streaming: boolean
  loading: boolean
  summary: string | null
  sliders: PresetSliders | null
  reportedMessages: Set<number>
  isAtLimit: boolean
  isNearLimit: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  childSession: ChildSession | null
  sendMessage: (text: string) => void
  handleReport: (messageIndex: number) => void
  deleteConversation: () => void
}

/**
 * Chat page state (plan §5.3/§5.4). P4 ports the NON-streaming structure:
 * loading an existing conversation's history + summary, the session-limit
 * banners, report/delete affordances.
 *
 * TODO(P5): token streaming is P5. `sendMessage` here is a stub — the live SSE
 * reader (`/api/chat/stream`, the pipeline call, flag persistence, message
 * saving) is built in P5. `sliders` stays null because loading the child's own
 * guardrail config needs the P5 child-scoped path (children.config is
 * parent-only); with null sliders the session limit is unbounded and intent
 * gating is off until then.
 */
export function useChat({ conversationId }: UseChatOptions = {}): UseChatResult {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming] = useState(false)
  const [loading, setLoading] = useState<boolean>(Boolean(conversationId))
  const [summary, setSummary] = useState<string | null>(null)
  const [sliders] = useState<PresetSliders | null>(null)
  const [reportedMessages, setReportedMessages] = useState<Set<number>>(new Set())
  const [messageCount] = useState(0)

  const childSessionRef = useRef<ChildSession | null>(getChildSession())
  const currentConversationId = useRef<string | null>(conversationId ?? null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!childSessionRef.current) {
      void navigate({ to: '/child/login' })
    }
  }, [navigate])

  useEffect(() => {
    if (!conversationId) return
    currentConversationId.current = conversationId

    const load = async (): Promise<void> => {
      try {
        const [existing, summaryResult] = await Promise.all([
          trpcClient.conversations.messages.query({ conversationId }),
          trpcClient.conversations.summary
            .query({ conversationId })
            .catch(() => ({ summary: null })),
        ])
        if (summaryResult.summary) setSummary(summaryResult.summary)

        if (existing.length === 0 && !summaryResult.summary) {
          void navigate({ to: '/child/home' })
          return
        }
        setMessages(
          existing.map((m) => ({
            role: m.role as 'child' | 'ai',
            content: m.content,
            flagged: m.flagged,
          })),
        )
      } catch {
        void navigate({ to: '/child/home' })
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [conversationId, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sessionLimit = getSessionLimit(sliders)
  const warningThreshold = Math.floor(sessionLimit * 0.8)
  const isAtLimit = messageCount >= sessionLimit
  const isNearLimit = messageCount >= warningThreshold && !isAtLimit && isFinite(sessionLimit)

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return
    // TODO(P5): stream the AI response over /api/chat/stream (SSE), persist the
    // child + AI messages and any pipeline flags. P4 only echoes the child's
    // message into the transcript so the page structure is exercisable.
    setMessages((prev) => [...prev, { role: 'child', content: text }])
    setInput('')
  }, [])

  const handleReport = useCallback((messageIndex: number) => {
    // TODO(P5): persist a `reported` flag via flags.create. P4 marks locally.
    setReportedMessages((prev) => new Set(prev).add(messageIndex))
  }, [])

  const deleteConversation = useCallback(() => {
    const id = currentConversationId.current
    if (!id) return
    void trpcClient.conversations.delete.mutate({ conversationId: id }).finally(() => {
      void navigate({ to: '/child/home' })
    })
  }, [navigate])

  return {
    messages,
    input,
    setInput,
    streaming,
    loading,
    summary,
    sliders,
    reportedMessages,
    isAtLimit,
    isNearLimit,
    messagesEndRef,
    childSession: childSessionRef.current,
    sendMessage,
    handleReport,
    deleteConversation,
  }
}
