import type { ConversationMessage } from '../../features/conversations/conversationsQueries.ts'
import { cn } from '../../lib/utils.ts'
import styles from './ReadOnlyTranscript.module.scss'

interface ReadOnlyTranscriptProps {
  messages: ConversationMessage[]
  flaggedMessageIds: Set<string>
}

export function ReadOnlyTranscript({ messages, flaggedMessageIds }: ReadOnlyTranscriptProps) {
  return (
    <div className={styles.scrollArea}>
      <div className={styles.messages}>
        {messages.map((msg) => {
          const isFlagged = flaggedMessageIds.has(msg.id)
          return (
            <div
              key={msg.id}
              className={cn(styles.row, msg.role === 'child' && styles.rowChild)}
              data-flagged={isFlagged ? 'true' : undefined}
              data-testid="transcript-message"
            >
              <div className={styles.bubbleWrap}>
                <div
                  className={cn(
                    styles.bubble,
                    isFlagged
                      ? styles.bubbleFlagged
                      : msg.role === 'child'
                        ? styles.bubbleChild
                        : styles.bubbleOther,
                  )}
                >
                  <p className={styles.text}>{msg.content}</p>
                </div>
                <div className={styles.timestamp}>
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
