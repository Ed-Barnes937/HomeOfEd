import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getSessionLimit, MAX_CONVERSATION_TITLE_LEN } from '../../lib/chatConfig.ts'
import { getChildSession, type ChildSession } from '../../lib/childSession.ts'
import { streamChat } from '../../lib/chatStream.ts'
import { getDeviceToken } from '../../lib/deviceToken.ts'
import type { PresetSliders } from '../../server/domain/presets.ts'
import { fetchMyConfig } from '../children/childrenQueries.ts'
import {
  createConversation,
  saveMessage,
  deleteConversation as deleteConversationMutation,
} from '../conversations/conversationsQueries.ts'
import { createFlag } from '../flags/flagsQueries.ts'
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
 * Chat page state (plan §5.3/§5.4). P5 completes the live token stream: the SSE
 * reader (`lib/chatStream.streamChat`, buffered — no dropped tokens) drives the
 * transcript; the child + AI messages are persisted through tRPC
 * (conversations.*), while the pipeline's guardrail FLAGS are persisted
 * server-side by the SSE route (this client only marks the AI message flagged).
 * The child's own guardrail config loads via `children.myConfig` (#36), so the
 * session-limit banner is live again.
 */
export function useChat({ conversationId }: UseChatOptions = {}): UseChatResult {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState<boolean>(Boolean(conversationId))
  const [summary, setSummary] = useState<string | null>(null)
  const [sliders, setSliders] = useState<PresetSliders | null>(null)
  const [reportedMessages, setReportedMessages] = useState<Set<number>>(new Set())
  const [messageCount, setMessageCount] = useState(0)

  const childSessionRef = useRef<ChildSession | null>(getChildSession())
  const currentConversationId = useRef<string | null>(conversationId ?? null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Aborts the in-flight stream on unmount / navigation.
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!childSessionRef.current) {
      void navigate({ to: '/child/login' })
    }
  }, [navigate])

  // Load the child's own guardrail config (sliders + calibration) for the
  // session-limit gate. Server-authorised by the child cookie (#36).
  useEffect(() => {
    if (!childSessionRef.current) return
    let cancelled = false
    const loadConfig = async (): Promise<void> => {
      try {
        const config = await fetchMyConfig()
        if (cancelled) return
        setSliders(config.sliders)
      } catch {
        // Chat still works with the pipeline's own preset defaults.
      }
    }
    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

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
        setMessageCount(existing.length)
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

  // Abort any in-flight stream on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const sessionLimit = getSessionLimit(sliders)
  const warningThreshold = Math.floor(sessionLimit * 0.8)
  const isAtLimit = messageCount >= sessionLimit
  const isNearLimit = messageCount >= warningThreshold && !isAtLimit && isFinite(sessionLimit)

  const ensureConversation = async (firstMessage: string): Promise<string> => {
    if (currentConversationId.current) return currentConversationId.current
    const title = firstMessage.slice(0, MAX_CONVERSATION_TITLE_LEN)
    const conversation = await createConversation({ title })
    currentConversationId.current = conversation.id
    return conversation.id
  }

  const runSend = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim() || streaming || isAtLimit) return

      const newMessages: ChatMessage[] = [...messages, { role: 'child', content: text }]
      setMessages(newMessages)
      setInput('')
      setStreaming(true)
      // Placeholder AI bubble the tokens stream into.
      setMessages([...newMessages, { role: 'ai', content: '' }])

      const controller = new AbortController()
      abortRef.current = controller

      let childCounted = false
      try {
        const convoId = await ensureConversation(text)
        await saveMessage({ conversationId: convoId, role: 'child', content: text })
        setMessageCount((prev) => prev + 1)
        childCounted = true

        const stream = streamChat(
          {
            message: text,
            conversationId: convoId,
            deviceToken: getDeviceToken() ?? undefined,
            history: newMessages.map((m) => ({
              role: m.role === 'child' ? 'user' : 'assistant',
              content: m.content,
            })),
          },
          controller.signal,
        )

        let aiContent = ''
        let wasFlagged = false
        let errored = false

        for await (const chunk of stream) {
          if ('error' in chunk) {
            errored = true
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                role: 'ai',
                content: 'Sorry, something went wrong. Please try again.',
              }
              return updated
            })
            break
          }
          if ('flag' in chunk) {
            // The SSE route already persisted the flag server-side (#35); we
            // only note that the AI response was flagged.
            wasFlagged = true
            continue
          }
          // token
          aiContent += chunk.token
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            updated[updated.length - 1] = {
              role: 'ai',
              content: (last?.content ?? '') + chunk.token,
              flagged: last?.flagged,
            }
            return updated
          })
        }

        if (aiContent && !errored) {
          await saveMessage({
            conversationId: convoId,
            role: 'ai',
            content: aiContent,
            flagged: wasFlagged,
          })
          setMessageCount((prev) => prev + 1)
        }
      } catch (err) {
        // A deliberate abort (unmount / navigation) is not an error.
        if (controller.signal.aborted) return
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'ai',
            content: 'Sorry, something went wrong. Please try again.',
          }
          return updated
        })
        void err
        if (childCounted) setMessageCount((prev) => Math.max(0, prev - 1))
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setStreaming(false)
      }
    },
    [messages, streaming, isAtLimit],
  )

  const sendMessage = useCallback(
    (text: string) => {
      void runSend(text)
    },
    [runSend],
  )

  const handleReport = useCallback(
    (messageIndex: number) => {
      const child = childSessionRef.current
      if (!child || reportedMessages.has(messageIndex)) return

      const aiMsg = messages[messageIndex]
      const childMsg = messages[messageIndex - 1]
      setReportedMessages((prev) => new Set(prev).add(messageIndex))

      void createFlag({
        childId: child.id,
        conversationId: currentConversationId.current ?? undefined,
        type: 'reported',
        reason: 'Child reported unsatisfactory answer',
        childMessage: childMsg?.content,
        aiResponse: aiMsg?.content,
        deviceToken: getDeviceToken() ?? undefined,
      }).catch(() => {
        // Best-effort; the local "Reported" state already reflects the intent.
      })
    },
    [messages, reportedMessages],
  )

  const deleteConversation = useCallback(() => {
    const id = currentConversationId.current
    if (!id) return
    void deleteConversationMutation(id).finally(() => {
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
