// conversations.* query-option factories + mutation fns (replaces
// `api/conversations.ts` + `queries/conversations.ts`). Reads are dual-role
// (owning parent OR the conversation's own child) — authorised server-side.
import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

export type ConversationSummary = Awaited<
  ReturnType<typeof trpcClient.conversations.list.query>
>[number]
export type ConversationMessage = Awaited<
  ReturnType<typeof trpcClient.conversations.messages.query>
>[number]

export function conversationsQueryOptions(childId: string) {
  return queryOptions({
    queryKey: ['conversations', childId],
    queryFn: () => trpcClient.conversations.list.query({ childId }),
  })
}

export function conversationMessagesQueryOptions(conversationId: string) {
  return queryOptions({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () => trpcClient.conversations.messages.query({ conversationId }),
  })
}

export const deleteConversation = (conversationId: string) =>
  trpcClient.conversations.delete.mutate({ conversationId })
