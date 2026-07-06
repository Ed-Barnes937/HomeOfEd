import type { DbClient } from '@hoe/db'
import { and, eq, gte } from 'drizzle-orm'

import {
  behaviouralEvents,
  children,
  conversations,
  flags,
  messages,
  type SproutSchema,
  user,
} from './schema.ts'

// Row/insert shapes inferred straight from the Drizzle tables so the Store stays
// in lockstep with the schema.
type UserInsert = typeof user.$inferInsert
type ChildInsert = typeof children.$inferInsert
type ChildRow = typeof children.$inferSelect
type ConversationInsert = typeof conversations.$inferInsert
type ConversationRow = typeof conversations.$inferSelect
type MessageInsert = typeof messages.$inferInsert
type MessageRow = typeof messages.$inferSelect
type FlagInsert = typeof flags.$inferInsert
type FlagRow = typeof flags.$inferSelect
type BehaviouralEventInsert = typeof behaviouralEvents.$inferInsert

// `.returning()` always yields ≥1 row after an insert, but the compiler can't
// know that under noUncheckedIndexedAccess.
function first<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (row === undefined) {
    throw new Error('expected at least one row')
  }
  return row
}

/**
 * sprout's Store interface — the server-side query surface (plan §6.6).
 *
 * P1 establishes the interface + Drizzle impl with a REPRESENTATIVE, non-trivial
 * slice (children, conversations, messages, flags, behavioural events, plus the
 * parent user for FK/cascade) — enough to prove the merged schema round-trips on
 * PGlite. It is NOT the full ~30-endpoint surface: **P3 (backend) extends this
 * interface per handler** as each tRPC procedure is converted.
 */
export interface SproutStore {
  /** Deep liveness: a real round-trip used by the health check. */
  ping(): Promise<{ ok: true }>

  /** Create a parent account (the Better Auth `user` row). Returns its id. */
  createUser(input: UserInsert): Promise<string>
  /** Delete a parent account; FKs cascade to children/devices and below. */
  deleteUser(id: string): Promise<void>

  createChild(input: ChildInsert): Promise<ChildRow>
  getChild(id: string): Promise<ChildRow | null>
  listChildrenByParent(parentId: string): Promise<ChildRow[]>

  createConversation(input: ConversationInsert): Promise<ConversationRow>
  addMessage(input: MessageInsert): Promise<MessageRow>
  listMessages(conversationId: string): Promise<MessageRow[]>

  createFlag(input: FlagInsert): Promise<FlagRow>
  listFlagsByChild(childId: string): Promise<FlagRow[]>

  recordBehaviouralEvent(input: BehaviouralEventInsert): Promise<void>
  /** Composite-index query: count events for a child of a kind since a time. */
  countBehaviouralEvents(childId: string, kind: string, since: Date): Promise<number>
}

export class DrizzleSproutStore implements SproutStore {
  private readonly db: DbClient<SproutSchema>

  constructor(db: DbClient<SproutSchema>) {
    this.db = db
  }

  async ping(): Promise<{ ok: true }> {
    await this.db.select().from(user).limit(1)
    return { ok: true }
  }

  async createUser(input: UserInsert): Promise<string> {
    const rows = await this.db.insert(user).values(input).returning({ id: user.id })
    return first(rows).id
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.delete(user).where(eq(user.id, id))
  }

  async createChild(input: ChildInsert): Promise<ChildRow> {
    const rows = await this.db.insert(children).values(input).returning()
    return first(rows)
  }

  async getChild(id: string): Promise<ChildRow | null> {
    const rows = await this.db.select().from(children).where(eq(children.id, id)).limit(1)
    return rows[0] ?? null
  }

  async listChildrenByParent(parentId: string): Promise<ChildRow[]> {
    return this.db.select().from(children).where(eq(children.parentId, parentId))
  }

  async createConversation(input: ConversationInsert): Promise<ConversationRow> {
    const rows = await this.db.insert(conversations).values(input).returning()
    return first(rows)
  }

  async addMessage(input: MessageInsert): Promise<MessageRow> {
    const rows = await this.db.insert(messages).values(input).returning()
    return first(rows)
  }

  async listMessages(conversationId: string): Promise<MessageRow[]> {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
  }

  async createFlag(input: FlagInsert): Promise<FlagRow> {
    const rows = await this.db.insert(flags).values(input).returning()
    return first(rows)
  }

  async listFlagsByChild(childId: string): Promise<FlagRow[]> {
    return this.db.select().from(flags).where(eq(flags.childId, childId))
  }

  async recordBehaviouralEvent(input: BehaviouralEventInsert): Promise<void> {
    await this.db.insert(behaviouralEvents).values(input)
  }

  async countBehaviouralEvents(childId: string, kind: string, since: Date): Promise<number> {
    const rows = await this.db
      .select({ id: behaviouralEvents.id })
      .from(behaviouralEvents)
      .where(
        and(
          eq(behaviouralEvents.childId, childId),
          eq(behaviouralEvents.kind, kind),
          gte(behaviouralEvents.createdAt, since),
        ),
      )
    return rows.length
  }
}
