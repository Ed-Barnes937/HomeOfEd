// Ported from the source `routes/child/chat/new.tsx`. P5 completes the live
// token stream (useChat.sendMessage) and re-enables the intent-selection gate:
// with the child's guardrail config now loaded (children.myConfig, #36), a
// restricted `interactionMode` shows structured intent prompts instead of a
// free text box.
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { ChatInput } from '../components/chat/ChatInput.tsx'
import { ChatTranscript } from '../components/chat/ChatTranscript.tsx'
import { Button } from '../components/ui/button.tsx'
import { useChat } from '../features/chat/useChat.ts'
import {
  getRandomTopic,
  INSPIRE_SESSION_KEY,
  INTENT_CATEGORIES,
  RESTRICTED_INTERACTION_THRESHOLD,
} from '../lib/chatConfig.ts'
import styles from './ChatNewPage.module.scss'

export function ChatNewPage() {
  const navigate = useNavigate()
  const [dismissedIntent, setDismissedIntent] = useState(false)
  const [autoInspireHandled, setAutoInspireHandled] = useState(false)

  const {
    messages,
    input,
    setInput,
    streaming,
    sliders,
    reportedMessages,
    isAtLimit,
    isNearLimit,
    messagesEndRef,
    sendMessage,
    handleReport,
  } = useChat()

  useEffect(() => {
    const topic = sessionStorage.getItem(INSPIRE_SESSION_KEY)
    if (!topic) return
    sessionStorage.removeItem(INSPIRE_SESSION_KEY)
    setAutoInspireHandled(true)
    sendMessage(topic)
  }, [sendMessage])

  const showIntentSelection =
    !dismissedIntent &&
    !autoInspireHandled &&
    sliders !== null &&
    sliders.interactionMode <= RESTRICTED_INTERACTION_THRESHOLD &&
    messages.length === 0 &&
    !streaming

  const handleSubmit = () => {
    setDismissedIntent(true)
    sendMessage(input)
  }

  const handleIntentSelect = (prompt: string) => {
    setDismissedIntent(true)
    setInput(prompt)
  }

  const handleInspireMe = () => {
    setDismissedIntent(true)
    sendMessage(getRandomTopic())
  }

  if (showIntentSelection) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/child/home' })}>
            Back
          </Button>
          <h1 className={styles.headerTitle}>What would you like to do?</h1>
          <div className={styles.spacer} />
        </header>

        <div className={styles.intentBody}>
          <div className={styles.intentGrid}>
            {INTENT_CATEGORIES.map((intent) => (
              <button
                key={intent.id}
                data-testid={`intent-${intent.id}`}
                onClick={() => handleIntentSelect(intent.prompt)}
                className={styles.intentButton}
              >
                <span className={styles.intentEmoji}>{intent.emoji}</span>
                <span className={styles.intentLabel}>{intent.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.inspireWrap}>
            <Button variant="outline" data-testid="inspire-me" onClick={handleInspireMe}>
              Inspire me
            </Button>
          </div>

          <button className={styles.typeOwnButton} onClick={() => setDismissedIntent(true)}>
            Or just type your own question
          </button>
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
        <h1 className={styles.headerTitle}>New conversation</h1>
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
        emptyState={
          <p className={styles.emptyText}>Ask me anything! I&apos;m here to help you learn.</p>
        }
      />

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={streaming || isAtLimit}
        canSubmit={Boolean(input.trim())}
        extraAction={
          messages.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              data-testid="inspire-me"
              onClick={handleInspireMe}
              disabled={streaming}
            >
              Inspire me
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}
