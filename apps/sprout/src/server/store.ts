import type { DbClient } from '@hoe/db'
import { and, count, desc, eq, gte, inArray, lt } from 'drizzle-orm'

import {
  behaviouralEvents,
  calibrationAnswers,
  children,
  conversations,
  devices,
  flags,
  messages,
  parentSeededTopics,
  presets,
  type SproutSchema,
  user,
} from './schema.ts'

// Row/insert shapes inferred straight from the Drizzle tables so the Store stays
// in lockstep with the schema.
type UserInsert = typeof user.$inferInsert
type ChildInsert = typeof children.$inferInsert
type ChildRow = typeof children.$inferSelect
type PresetInsert = typeof presets.$inferInsert
type PresetRow = typeof presets.$inferSelect
type CalibrationRow = typeof calibrationAnswers.$inferSelect
type DeviceInsert = typeof devices.$inferInsert
type DeviceRow = typeof devices.$inferSelect
type ConversationInsert = typeof conversations.$inferInsert
type ConversationRow = typeof conversations.$inferSelect
type MessageInsert = typeof messages.$inferInsert
type MessageRow = typeof messages.$inferSelect
type FlagInsert = typeof flags.$inferInsert
type FlagRow = typeof flags.$inferSelect
type ParentSeededTopicRow = typeof parentSeededTopics.$inferSelect
type BehaviouralEventInsert = typeof behaviouralEvents.$inferInsert

/** A child-scoped credential/profile update. `pinHash`/`passwordHash` are the
 * already-hashed values — hashing happens in the handler (never in the Store). */
export type ChildUpdate = Partial<
  Pick<ChildRow, 'displayName' | 'presetName' | 'pinHash' | 'passwordHash' | 'mustChangePassword'>
>

/** The seven preset slider columns a parent may set (no id/childId/name/dates). */
export type PresetSliderPatch = Partial<
  Pick<
    PresetRow,
    | 'vocabularyLevel'
    | 'responseDepth'
    | 'answeringStyle'
    | 'interactionMode'
    | 'topicAccess'
    | 'sessionLimits'
    | 'parentVisibility'
  >
>

/** One calibration answer, decoupled from the domain type. */
export interface CalibrationAnswerInput {
  questionId: string
  selectedLevel: number | null
  customAnswer: string | null
}

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
 * sprout's Store interface — the FULL server-side query surface for the tRPC
 * backend (plan §5.1 / §6.6). This is the contract the P3b squad codes against:
 * every method the ~25 procedures across all router groups need is declared
 * here, grouped by router area. `DrizzleSproutStore` implements ALL of them;
 * `FakeSproutStore` (server/testing/) fakes ALL of them for handler unit tests.
 *
 * Identity derivation is deliberately NOT in the Store — handlers derive
 * `parentId`/`childId` from `ctx.auth` and pass explicit ids (ownership checks
 * live in handlers, resolving review #34/#35/#36).
 */
export interface SproutStore {
  // --- Health ---------------------------------------------------------------
  /** Deep liveness: a real round-trip used by the health check. */
  ping(): Promise<{ ok: true }>

  // --- Parent accounts (Better Auth `user`) --------------------------------
  // Better Auth owns the write path in prod; these support tests + the FK
  // anchor + account erasure.
  /** Create a parent account (the Better Auth `user` row). Returns its id. */
  createUser(input: UserInsert): Promise<string>
  /** Delete a parent account; FKs cascade to children/devices and below. */
  deleteUser(id: string): Promise<void>

  // --- children.{list,get,create,update} -----------------------------------
  createChild(input: ChildInsert): Promise<ChildRow>
  getChild(id: string): Promise<ChildRow | null>
  getChildByUsername(username: string): Promise<ChildRow | null>
  listChildrenByParent(parentId: string): Promise<ChildRow[]>
  /** Apply a partial patch; returns the updated row (null if the child is gone). */
  updateChild(id: string, patch: ChildUpdate): Promise<ChildRow | null>

  // --- children.config / children.preset (presets table) -------------------
  createPreset(input: PresetInsert): Promise<PresetRow>
  getPresetByChild(childId: string): Promise<PresetRow | null>
  /** Patch the slider columns for a child's preset; bumps updatedAt. */
  updatePreset(childId: string, patch: PresetSliderPatch): Promise<PresetRow | null>

  // --- children.config / children.calibration (calibration_answers) --------
  createCalibrationAnswers(childId: string, answers: CalibrationAnswerInput[]): Promise<void>
  listCalibrationAnswers(childId: string): Promise<CalibrationRow[]>
  /** Replace a child's calibration set atomically; returns the new set. */
  replaceCalibrationAnswers(
    childId: string,
    answers: CalibrationAnswerInput[],
  ): Promise<CalibrationRow[]>

  // --- childAuth.{loginPassword,loginPin,deviceChildren} (devices) ---------
  getDeviceByToken(deviceToken: string): Promise<DeviceRow | null>
  createDevice(input: DeviceInsert): Promise<DeviceRow>

  // --- children.topics.{list,add,remove} (parent_seeded_topics) ------------
  listParentSeededTopics(childId: string): Promise<ParentSeededTopicRow[]>
  createParentSeededTopic(childId: string, topic: string): Promise<ParentSeededTopicRow>
  deleteParentSeededTopic(topicId: string): Promise<void>

  // --- conversations.{create,list,summary,delete,summariseAndPurge} --------
  createConversation(input: ConversationInsert): Promise<ConversationRow>
  getConversation(id: string): Promise<ConversationRow | null>
  listConversationsByChild(childId: string): Promise<ConversationRow[]>
  deleteConversation(id: string): Promise<void>
  /** Bump `updatedAt` to now (called when a message is saved). */
  touchConversation(id: string): Promise<void>
  /** Set the summary and purge all messages atomically (summariseAndPurge / worker). */
  summariseAndPurgeConversation(id: string, summary: string): Promise<void>
  /**
   * Retention worker (P9): conversations whose `updatedAt` predates `before`
   * that STILL have messages — i.e. due for summarise+purge. Already-purged
   * conversations (summary set, no messages) are excluded so a repeated sweep
   * never re-processes them.
   */
  listConversationsForRetention(before: Date): Promise<ConversationRow[]>

  // --- conversations.{messages,saveMessage} + children.stats (messages) ----
  addMessage(input: MessageInsert): Promise<MessageRow>
  listMessages(conversationId: string): Promise<MessageRow[]>
  countMessagesByConversations(conversationIds: string[]): Promise<number>

  // --- flags.{list,create,review} ------------------------------------------
  createFlag(input: FlagInsert): Promise<FlagRow>
  getFlag(id: string): Promise<FlagRow | null>
  listFlagsByChild(childId: string): Promise<FlagRow[]>
  listFlagsByChildren(childIds: string[]): Promise<FlagRow[]>
  /** Set the reviewed flag; returns the updated row (null if the flag is gone). */
  setFlagReviewed(id: string, reviewed: boolean): Promise<FlagRow | null>

  // --- behavioural_events (childAuth PIN lockout, flags probe, chat, worker) -
  recordBehaviouralEvent(input: BehaviouralEventInsert): Promise<void>
  /** Windowed count keyed by child and/or device (see behavioural-limits.ts). */
  countBehaviouralEvents(opts: {
    kind: string
    since: Date
    childId?: string
    deviceToken?: string
  }): Promise<number>
  /** Drop this child's / device's events older than `before` (retention). */
  pruneBehaviouralEvents(opts: {
    childId?: string
    deviceToken?: string
    before: Date
  }): Promise<void>
  /**
   * Retention worker (P9): drop ALL behavioural events older than `before`,
   * regardless of child/device key — a global compliance sweep, distinct from
   * the per-key write-path prune above (which only touches the acting key).
   */
  pruneBehaviouralEventsBefore(before: Date): Promise<void>
}

export class DrizzleSproutStore implements SproutStore {
  private readonly db: DbClient<SproutSchema>

  constructor(db: DbClient<SproutSchema>) {
    this.db = db
  }

  // --- Health ---------------------------------------------------------------

  async ping(): Promise<{ ok: true }> {
    await this.db.select().from(user).limit(1)
    return { ok: true }
  }

  // --- Parent accounts ------------------------------------------------------

  async createUser(input: UserInsert): Promise<string> {
    const rows = await this.db.insert(user).values(input).returning({ id: user.id })
    return first(rows).id
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.delete(user).where(eq(user.id, id))
  }

  // --- Children -------------------------------------------------------------

  async createChild(input: ChildInsert): Promise<ChildRow> {
    const rows = await this.db.insert(children).values(input).returning()
    return first(rows)
  }

  async getChild(id: string): Promise<ChildRow | null> {
    const rows = await this.db.select().from(children).where(eq(children.id, id)).limit(1)
    return rows[0] ?? null
  }

  async getChildByUsername(username: string): Promise<ChildRow | null> {
    const rows = await this.db
      .select()
      .from(children)
      .where(eq(children.username, username))
      .limit(1)
    return rows[0] ?? null
  }

  async listChildrenByParent(parentId: string): Promise<ChildRow[]> {
    return this.db.select().from(children).where(eq(children.parentId, parentId))
  }

  async updateChild(id: string, patch: ChildUpdate): Promise<ChildRow | null> {
    const rows = await this.db.update(children).set(patch).where(eq(children.id, id)).returning()
    return rows[0] ?? null
  }

  // --- Presets --------------------------------------------------------------

  async createPreset(input: PresetInsert): Promise<PresetRow> {
    const rows = await this.db.insert(presets).values(input).returning()
    return first(rows)
  }

  async getPresetByChild(childId: string): Promise<PresetRow | null> {
    const rows = await this.db.select().from(presets).where(eq(presets.childId, childId)).limit(1)
    return rows[0] ?? null
  }

  async updatePreset(childId: string, patch: PresetSliderPatch): Promise<PresetRow | null> {
    const rows = await this.db
      .update(presets)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(presets.childId, childId))
      .returning()
    return rows[0] ?? null
  }

  // --- Calibration ----------------------------------------------------------

  async createCalibrationAnswers(
    childId: string,
    answers: CalibrationAnswerInput[],
  ): Promise<void> {
    if (answers.length === 0) return
    await this.db
      .insert(calibrationAnswers)
      .values(answers.map((a) => ({ childId, ...a })))
  }

  async listCalibrationAnswers(childId: string): Promise<CalibrationRow[]> {
    return this.db
      .select()
      .from(calibrationAnswers)
      .where(eq(calibrationAnswers.childId, childId))
  }

  async replaceCalibrationAnswers(
    childId: string,
    answers: CalibrationAnswerInput[],
  ): Promise<CalibrationRow[]> {
    return this.db.transaction(async (tx) => {
      await tx.delete(calibrationAnswers).where(eq(calibrationAnswers.childId, childId))
      if (answers.length > 0) {
        await tx.insert(calibrationAnswers).values(answers.map((a) => ({ childId, ...a })))
      }
      return tx.select().from(calibrationAnswers).where(eq(calibrationAnswers.childId, childId))
    })
  }

  // --- Devices --------------------------------------------------------------

  async getDeviceByToken(deviceToken: string): Promise<DeviceRow | null> {
    const rows = await this.db
      .select()
      .from(devices)
      .where(eq(devices.deviceToken, deviceToken))
      .limit(1)
    return rows[0] ?? null
  }

  async createDevice(input: DeviceInsert): Promise<DeviceRow> {
    const rows = await this.db.insert(devices).values(input).returning()
    return first(rows)
  }

  // --- Parent-seeded topics -------------------------------------------------

  async listParentSeededTopics(childId: string): Promise<ParentSeededTopicRow[]> {
    return this.db
      .select()
      .from(parentSeededTopics)
      .where(eq(parentSeededTopics.childId, childId))
      .orderBy(desc(parentSeededTopics.createdAt))
  }

  async createParentSeededTopic(childId: string, topic: string): Promise<ParentSeededTopicRow> {
    const rows = await this.db.insert(parentSeededTopics).values({ childId, topic }).returning()
    return first(rows)
  }

  async deleteParentSeededTopic(topicId: string): Promise<void> {
    await this.db.delete(parentSeededTopics).where(eq(parentSeededTopics.id, topicId))
  }

  // --- Conversations --------------------------------------------------------

  async createConversation(input: ConversationInsert): Promise<ConversationRow> {
    const rows = await this.db.insert(conversations).values(input).returning()
    return first(rows)
  }

  async getConversation(id: string): Promise<ConversationRow | null> {
    const rows = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
    return rows[0] ?? null
  }

  async listConversationsByChild(childId: string): Promise<ConversationRow[]> {
    return this.db
      .select()
      .from(conversations)
      .where(eq(conversations.childId, childId))
      .orderBy(desc(conversations.updatedAt))
  }

  async deleteConversation(id: string): Promise<void> {
    await this.db.delete(conversations).where(eq(conversations.id, id))
  }

  async touchConversation(id: string): Promise<void> {
    await this.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, id))
  }

  async summariseAndPurgeConversation(id: string, summary: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(conversations).set({ summary }).where(eq(conversations.id, id))
      await tx.delete(messages).where(eq(messages.conversationId, id))
    })
  }

  async listConversationsForRetention(before: Date): Promise<ConversationRow[]> {
    // INNER JOIN on messages + DISTINCT keeps only conversations that still have
    // messages (already-purged rows have none), so a sweep never re-processes them.
    return this.db
      .selectDistinct({
        id: conversations.id,
        childId: conversations.childId,
        title: conversations.title,
        summary: conversations.summary,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .innerJoin(messages, eq(messages.conversationId, conversations.id))
      .where(lt(conversations.updatedAt, before))
  }

  // --- Messages -------------------------------------------------------------

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

  async countMessagesByConversations(conversationIds: string[]): Promise<number> {
    if (conversationIds.length === 0) return 0
    const rows = await this.db
      .select({ value: count() })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
    return rows[0]?.value ?? 0
  }

  // --- Flags ----------------------------------------------------------------

  async createFlag(input: FlagInsert): Promise<FlagRow> {
    const rows = await this.db.insert(flags).values(input).returning()
    return first(rows)
  }

  async getFlag(id: string): Promise<FlagRow | null> {
    const rows = await this.db.select().from(flags).where(eq(flags.id, id)).limit(1)
    return rows[0] ?? null
  }

  async listFlagsByChild(childId: string): Promise<FlagRow[]> {
    return this.db
      .select()
      .from(flags)
      .where(eq(flags.childId, childId))
      .orderBy(desc(flags.createdAt))
  }

  async listFlagsByChildren(childIds: string[]): Promise<FlagRow[]> {
    if (childIds.length === 0) return []
    return this.db
      .select()
      .from(flags)
      .where(inArray(flags.childId, childIds))
      .orderBy(desc(flags.createdAt))
  }

  async setFlagReviewed(id: string, reviewed: boolean): Promise<FlagRow | null> {
    const rows = await this.db
      .update(flags)
      .set({ reviewed })
      .where(eq(flags.id, id))
      .returning()
    return rows[0] ?? null
  }

  // --- Behavioural events ---------------------------------------------------

  async recordBehaviouralEvent(input: BehaviouralEventInsert): Promise<void> {
    await this.db.insert(behaviouralEvents).values(input)
  }

  async countBehaviouralEvents(opts: {
    kind: string
    since: Date
    childId?: string
    deviceToken?: string
  }): Promise<number> {
    const conditions = [
      eq(behaviouralEvents.kind, opts.kind),
      gte(behaviouralEvents.createdAt, opts.since),
    ]
    if (opts.childId) conditions.push(eq(behaviouralEvents.childId, opts.childId))
    if (opts.deviceToken) conditions.push(eq(behaviouralEvents.deviceToken, opts.deviceToken))

    const rows = await this.db
      .select({ value: count() })
      .from(behaviouralEvents)
      .where(and(...conditions))
    return rows[0]?.value ?? 0
  }

  async pruneBehaviouralEvents(opts: {
    childId?: string
    deviceToken?: string
    before: Date
  }): Promise<void> {
    if (opts.childId) {
      await this.db
        .delete(behaviouralEvents)
        .where(
          and(
            eq(behaviouralEvents.childId, opts.childId),
            lt(behaviouralEvents.createdAt, opts.before),
          ),
        )
    }
    if (opts.deviceToken) {
      await this.db
        .delete(behaviouralEvents)
        .where(
          and(
            eq(behaviouralEvents.deviceToken, opts.deviceToken),
            lt(behaviouralEvents.createdAt, opts.before),
          ),
        )
    }
  }

  async pruneBehaviouralEventsBefore(before: Date): Promise<void> {
    await this.db.delete(behaviouralEvents).where(lt(behaviouralEvents.createdAt, before))
  }
}
