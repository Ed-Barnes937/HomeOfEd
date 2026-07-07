// Shared zod schema + output shape for the flags group. FlagType matches the
// source's packages/shared types/chat.ts enum verbatim.
import { z } from 'zod'

import type { flags } from '../../schema.ts'

export const flagTypeSchema = z.enum(['sensitive', 'blocked', 'validation-failed', 'reported'])
export type FlagType = z.infer<typeof flagTypeSchema>

type FlagRow = typeof flags.$inferSelect

/** The wire shape of a flag: Dates become ISO strings (no transformer on this router). */
export interface FlagRecord {
  id: string
  childId: string
  conversationId: string | null
  messageId: string | null
  type: FlagType
  reason: string
  childMessage: string | null
  aiResponse: string | null
  topics: string | null
  reviewed: boolean
  createdAt: string
}

export function toFlagRecord(row: FlagRow): FlagRecord {
  return {
    id: row.id,
    childId: row.childId,
    conversationId: row.conversationId,
    messageId: row.messageId,
    type: row.type as FlagType,
    reason: row.reason,
    childMessage: row.childMessage,
    aiResponse: row.aiResponse,
    topics: row.topics,
    reviewed: row.reviewed,
    createdAt: row.createdAt.toISOString(),
  }
}
