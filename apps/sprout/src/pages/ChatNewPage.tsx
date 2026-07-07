// Ported from the source `routes/child/chat/new.tsx`. STRUCTURE ONLY: the live
// token stream is P5 (see features/chat/useChat — sendMessage is a stub). With
// sliders unavailable client-side in P4 the intent-selection gate stays off
// until the P5 child-scoped config path lands.
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { ChatInput } from '../components/chat/ChatInput.tsx'
import { ChatTranscript } from '../components/chat/ChatTranscript.tsx'
import { Button } from '../components/ui/button.tsx'
import { useChat } from '../features/chat/useChat.ts'
import { getRandomTopic, INSPIRE_SESSION_KEY } from '../lib/chatConfig.ts'

export function ChatNewPage() {
  const navigate = useNavigate()
  const {
    messages,
    input,
    setInput,
    streaming,
    reportedMessages,
    isAtLimit,
    isNearLimit,
    messagesEndRef,
    sendMessage,
    handleReport,
  } = useChat()

  const [autoInspireHandled, setAutoInspireHandled] = useState(false)

  useEffect(() => {
    const topic = sessionStorage.getItem(INSPIRE_SESSION_KEY)
    if (!topic) return
    sessionStorage.removeItem(INSPIRE_SESSION_KEY)
    setAutoInspireHandled(true)
    sendMessage(topic)
  }, [sendMessage])

  const handleInspireMe = () => sendMessage(getRandomTopic())

  // autoInspireHandled is retained from the source's intent-gate logic (P5).
  void autoInspireHandled

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/child/home' })}>
          Back
        </Button>
        <h1 className="text-sm font-medium">New conversation</h1>
        <div className="w-16" />
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
          <p className="text-muted-foreground text-center">
            Ask me anything! I&apos;m here to help you learn.
          </p>
        }
      />

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => sendMessage(input)}
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
