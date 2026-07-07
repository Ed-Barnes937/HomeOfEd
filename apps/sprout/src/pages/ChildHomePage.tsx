// Ported from the source `routes/child/home.tsx`. The child profile comes from
// localStorage (lib/childSession); the conversation list is a child-scoped tRPC
// read (authorised server-side once the child-session cookie is set — P5).
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button, buttonVariants } from '../components/ui/button.tsx'
import { conversationsQueryOptions } from '../features/conversations/conversationsQueries.ts'
import { getRandomTopic, INSPIRE_SESSION_KEY } from '../lib/chatConfig.ts'
import { clearChildSession, getChildSession } from '../lib/childSession.ts'
import styles from './ChildHomePage.module.scss'

export function ChildHomePage() {
  const navigate = useNavigate()
  const [session] = useState(() => getChildSession())

  useEffect(() => {
    if (!session) void navigate({ to: '/child/login' })
  }, [session, navigate])

  const { data: conversations = [] } = useQuery({
    ...conversationsQueryOptions(session?.id ?? ''),
    enabled: Boolean(session),
    retry: false,
  })

  const childName = session?.displayName ?? ''

  const handleLogout = () => {
    clearChildSession()
    void navigate({ to: '/' })
  }

  const handleInspireMe = () => {
    sessionStorage.setItem(INSPIRE_SESSION_KEY, getRandomTopic())
    void navigate({ to: '/child/chat/new' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Hi, {childName}!</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Log out
        </Button>
      </div>

      <div className={styles.main}>
        <div className={styles.actions}>
          <Link to="/child/chat/new" className={buttonVariants({ size: 'lg' })}>
            Start a new conversation
          </Link>
          <Button variant="outline" size="lg" data-testid="inspire-me" onClick={handleInspireMe}>
            Inspire me
          </Button>
        </div>

        {conversations.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>Previous conversations</h2>
            <div className={styles.convoList}>
              {conversations.map((convo) => (
                <Link
                  key={convo.id}
                  to="/child/chat/$conversationId"
                  params={{ conversationId: convo.id }}
                  className={styles.convoItem}
                  data-testid="conversation-item"
                >
                  <p className={styles.convoTitle}>{convo.title ?? 'Untitled'}</p>
                  <p className={styles.convoDate}>
                    {new Date(convo.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {conversations.length === 0 && (
          <p className={styles.emptyMessage}>
            What would you like to talk about?
          </p>
        )}
      </div>
    </div>
  )
}
