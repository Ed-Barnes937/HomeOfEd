// Ported from the source `routes/parent/conversations.$conversationId.tsx`.
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import { ReadOnlyTranscript } from '../components/dashboard/ReadOnlyTranscript.tsx'
import { Button } from '../components/ui/button.tsx'
import { conversationMessagesQueryOptions } from '../features/conversations/conversationsQueries.ts'
import { flagsQueryOptions } from '../features/flags/flagsQueries.ts'
import { useRequireParent } from '../features/parentAuth/useRequireParent.ts'
import styles from './ConversationDetailPage.module.scss'

const route = getRouteApi('/parent/conversations/$conversationId')

export function ConversationDetailPage() {
  const { conversationId } = route.useParams()
  const session = useRequireParent()

  const { data: flags } = useQuery({ ...flagsQueryOptions, enabled: Boolean(session.data) })
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    ...conversationMessagesQueryOptions(conversationId),
    enabled: Boolean(session.data),
  })

  const flaggedMessageIds = useMemo(() => {
    const ids = new Set<string>()
    for (const flag of flags ?? []) {
      if (flag.conversationId === conversationId && flag.messageId) ids.add(flag.messageId)
    }
    for (const msg of messages) {
      if (msg.flagged) ids.add(msg.id)
    }
    return ids
  }, [flags, conversationId, messages])

  const conversationTitle = useMemo(() => {
    const matching = flags?.find((f) => f.conversationId === conversationId)
    return matching ? `Conversation with ${matching.childDisplayName}` : 'Conversation Detail'
  }, [flags, conversationId])

  if (session.isPending) {
    return (
      <div className={styles.loading}>
        <p className={styles.mutedText}>Loading...</p>
      </div>
    )
  }

  if (!session.data) return null

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.heading} data-testid="conversation-title">
          {conversationTitle}
        </h1>
        <Link to="/parent/flags">
          <Button variant="outline" size="sm" data-testid="back-button">
            Back
          </Button>
        </Link>
      </div>

      <div className={styles.body}>
        {loadingMessages ? (
          <p className={styles.mutedTextSm}>Loading messages...</p>
        ) : messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.mutedText}>No messages found for this conversation.</p>
          </div>
        ) : (
          <ReadOnlyTranscript messages={messages} flaggedMessageIds={flaggedMessageIds} />
        )}
      </div>
    </div>
  )
}
