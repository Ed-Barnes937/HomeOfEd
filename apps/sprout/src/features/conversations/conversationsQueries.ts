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

export type CreateConversationInput = Parameters<typeof trpcClient.conversations.create.mutate>[0]
export type SaveMessageInput = Parameters<typeof trpcClient.conversations.saveMessage.mutate>[0]

/** conversations.create — the authenticated child starts a conversation
 * (childId is derived server-side from ctx.auth, never sent). */
export const createConversation = (input: CreateConversationInput) =>
  trpcClient.conversations.create.mutate(input)

/** conversations.saveMessage — append a child/ai message to the child's own
 * conversation (ownership checked server-side). */
export const saveMessage = (input: SaveMessageInput) =>
  trpcClient.conversations.saveMessage.mutate(input)

export const deleteConversation = (conversationId: string) =>
  trpcClient.conversations.delete.mutate({ conversationId })
