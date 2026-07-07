// Ported from the source (behaviour/markup). Tailwind classes retained
// verbatim; the SCSS-module rewrite is P7 (plan §8).
import type { ReactNode, RefObject } from 'react'

import type { ChatMessage } from '../../features/chat/useChat.ts'

interface ChatTranscriptProps {
  messages: ChatMessage[]
  streaming: boolean
  reportedMessages: Set<number>
  onReport: (messageIndex: number) => void
  isNearLimit: boolean
  isAtLimit: boolean
  messagesEndRef: RefObject<HTMLDivElement | null>
  emptyState?: ReactNode
}

export function ChatTranscript({
  messages,
  streaming,
  reportedMessages,
  onReport,
  isNearLimit,
  isAtLimit,
  messagesEndRef,
  emptyState,
}: ChatTranscriptProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 && emptyState && (
        <div className="flex h-full items-center justify-center">{emptyState}</div>
      )}

      <div className="mx-auto max-w-lg space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'child' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[80%]">
              <div
                data-testid={msg.role === 'ai' ? 'ai-message' : undefined}
                className={`rounded-2xl px-4 py-2 ${
                  msg.role === 'child'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">
                  {msg.content || (streaming && i === messages.length - 1 ? '...' : '')}
                </p>
              </div>
              {msg.role === 'ai' && msg.content && !streaming && (
                <div className="mt-1 flex justify-start">
                  <button
                    data-testid="report-button"
                    onClick={() => onReport(i)}
                    disabled={reportedMessages.has(i)}
                    className="text-muted-foreground hover:text-destructive text-xs disabled:opacity-50"
                  >
                    {reportedMessages.has(i) ? 'Reported' : 'Report this answer'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isNearLimit && (
          <div
            data-testid="session-warning"
            className="rounded-lg bg-yellow-50 p-3 text-center text-sm text-yellow-800"
          >
            You&apos;re getting close to your session limit. Try to wrap up soon!
          </div>
        )}

        {isAtLimit && (
          <div
            data-testid="session-limit"
            className="rounded-lg bg-orange-50 p-3 text-center text-sm text-orange-800"
          >
            You&apos;ve reached your session limit. Time for a break!
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
