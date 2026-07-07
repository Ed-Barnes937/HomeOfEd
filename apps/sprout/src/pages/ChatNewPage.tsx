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
      <div className="flex min-h-screen flex-col">
        <header className="border-border flex items-center justify-between border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/child/home' })}>
            Back
          </Button>
          <h1 className="text-sm font-medium">What would you like to do?</h1>
          <div className="w-16" />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
          <div className="mx-auto grid w-full max-w-md gap-3">
            {INTENT_CATEGORIES.map((intent) => (
              <button
                key={intent.id}
                data-testid={`intent-${intent.id}`}
                onClick={() => handleIntentSelect(intent.prompt)}
                className="bg-card hover:bg-accent border-border flex items-center gap-3 rounded-xl border p-4 text-left transition-colors"
              >
                <span className="text-2xl">{intent.emoji}</span>
                <span className="text-sm font-medium">{intent.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <Button variant="outline" data-testid="inspire-me" onClick={handleInspireMe}>
              Inspire me
            </Button>
          </div>

          <button
            className="text-muted-foreground mt-4 text-sm underline"
            onClick={() => setDismissedIntent(true)}
          >
            Or just type your own question
          </button>
        </div>
      </div>
    )
  }

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
