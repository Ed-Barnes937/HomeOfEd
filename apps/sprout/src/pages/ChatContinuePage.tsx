// Ported from the source `routes/child/chat/$conversationId.tsx`. STRUCTURE
// ONLY — loading history + summary works; the live token stream is P5 (useChat
// sendMessage is a stub).
import { getRouteApi, useNavigate } from '@tanstack/react-router'

import { ChatInput } from '../components/chat/ChatInput.tsx'
import { ChatTranscript } from '../components/chat/ChatTranscript.tsx'
import { Button } from '../components/ui/button.tsx'
import { useChat } from '../features/chat/useChat.ts'
import styles from './ChatContinuePage.module.scss'

const route = getRouteApi('/child/chat/$conversationId')

export function ChatContinuePage() {
  const navigate = useNavigate()
  const { conversationId } = route.useParams()
  const {
    messages,
    input,
    setInput,
    streaming,
    loading,
    summary,
    reportedMessages,
    isAtLimit,
    isNearLimit,
    messagesEndRef,
    sendMessage,
    handleReport,
    deleteConversation,
  } = useChat({ conversationId })

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <p className={styles.loadingText}>Loading conversation...</p>
      </div>
    )
  }

  if (summary && messages.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/child/home' })}>
            Back
          </Button>
          <h1 className={styles.headerTitle}>Conversation summary</h1>
          <div className={styles.spacer} />
        </header>

        <div className={styles.summaryBody}>
          <div className={styles.summaryContainer}>
            <div data-testid="conversation-summary" className={styles.summaryCard}>
              <p className={styles.summaryText}>{summary}</p>
            </div>
            <p className={styles.summaryNote}>
              The full conversation has been summarised to save space.
            </p>
            <div className={styles.deleteRow}>
              <Button
                variant="destructive"
                size="sm"
                data-testid="delete-conversation"
                onClick={deleteConversation}
              >
                Delete conversation
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/child/home' })}>
          Back
        </Button>
        <h1 className={styles.headerTitle}>Conversation</h1>
        <div className={styles.spacer} />
      </header>

      <ChatTranscript
        messages={messages}
        streaming={streaming}
        reportedMessages={reportedMessages}
        onReport={handleReport}
        isNearLimit={isNearLimit}
        isAtLimit={isAtLimit}
        messagesEndRef={messagesEndRef}
      />

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => sendMessage(input)}
        disabled={streaming || isAtLimit}
        canSubmit={Boolean(input.trim())}
      />
    </div>
  )
}
