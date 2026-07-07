// Output shapes shared across the conversations group's handlers (mirrors
// `children`'s `ChildSummary` reuse pattern). Dates are ISO strings, matching
// the source app's `handleCreateConversation`/`handleGetConversations`/etc.

/** conversations.create's output — the full row (the child just made it). */
export interface ConversationDto {
  id: string
  childId: string
  title: string | null
  createdAt: string
  updatedAt: string
}

/** conversations.list's output — one row per conversation, no `childId` (the caller already knows it). */
export interface ConversationSummaryDto {
  id: string
  title: string | null
  summary: string | null
  createdAt: string
  updatedAt: string
}

/** conversations.{messages,saveMessage}'s output. */
export interface MessageDto {
  id: string
  conversationId: string
  role: string
  content: string
  flagged: boolean
  createdAt: string
}
