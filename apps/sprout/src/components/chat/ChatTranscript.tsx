// Ported from the source (behaviour/markup). Tailwind classes retained
// verbatim; the SCSS-module rewrite is P7 (plan §8).
import type { ReactNode, RefObject } from 'react'

import type { ChatMessage } from '../../features/chat/useChat.ts'
import { cn } from '../../lib/utils.ts'
import styles from './ChatTranscript.module.scss'

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
    <div className={styles.scroll}>
      {messages.length === 0 && emptyState && (
        <div className={styles.empty}>{emptyState}</div>
      )}

      <div className={styles.list}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(styles.row, msg.role === 'child' ? styles.rowChild : styles.rowOther)}
          >
            <div className={styles.bubbleWrap}>
              <div
                data-testid={msg.role === 'ai' ? 'ai-message' : undefined}
                className={cn(
                  styles.bubble,
                  msg.role === 'child' ? styles.bubbleChild : styles.bubbleOther,
                )}
              >
                <p className={styles.messageText}>
                  {msg.content || (streaming && i === messages.length - 1 ? '...' : '')}
                </p>
              </div>
              {msg.role === 'ai' && msg.content && !streaming && (
                <div className={styles.reportRow}>
                  <button
                    data-testid="report-button"
                    onClick={() => onReport(i)}
                    disabled={reportedMessages.has(i)}
                    className={styles.reportButton}
                  >
                    {reportedMessages.has(i) ? 'Reported' : 'Report this answer'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isNearLimit && (
          <div data-testid="session-warning" className={styles.warningBanner}>
            You&apos;re getting close to your session limit. Try to wrap up soon!
          </div>
        )}

        {isAtLimit && (
          <div data-testid="session-limit" className={styles.limitBanner}>
            You&apos;ve reached your session limit. Time for a break!
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
