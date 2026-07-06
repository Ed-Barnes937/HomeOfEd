// In-memory FakeSproutStore — implements the FULL SproutStore interface so P3b
// handler unit tests need only import it (no bespoke fakes per group). Fast and
// synchronous under the hood; deterministic where the schema has DB-side
// defaults (ids via randomUUID, timestamps via an injectable `now`).
//
// This mirrors DrizzleSproutStore's observable behaviour, not its SQL: it
// applies the same NOT-NULL defaults the schema declares (mustChangePassword,
// presetName, preset sliders) and the same ordering (topics/flags/conversations
// newest-first, messages oldest-first) so a test passing here passes over PGlite.
import { randomUUID } from 'node:crypto'

import type {
  behaviouralEvents,
  calibrationAnswers,
  children,
  conversations,
  devices,
  flags,
  messages,
  parentSeededTopics,
  presets,
  user,
} from '../schema.ts'
import type {
  CalibrationAnswerInput,
  ChildUpdate,
  PresetSliderPatch,
  SproutStore,
} from '../store.ts'

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
type BehaviouralEventRow = typeof behaviouralEvents.$inferSelect

const PRESET_SLIDER_DEFAULTS = {
  vocabularyLevel: 1,
  responseDepth: 1,
  answeringStyle: 1,
  interactionMode: 1,
  topicAccess: 1,
  sessionLimits: 3,
  parentVisibility: 5,
}

export class FakeSproutStore implements SproutStore {
  private readonly now: () => Date

  private readonly users = new Map<string, typeof user.$inferSelect>()
  private readonly childRows = new Map<string, ChildRow>()
  private readonly presetRows = new Map<string, PresetRow>() // keyed by childId
  private readonly calibrationRows: CalibrationRow[] = []
  private readonly deviceRows = new Map<string, DeviceRow>() // keyed by deviceToken
  private readonly topicRows = new Map<string, ParentSeededTopicRow>()
  private readonly conversationRows = new Map<string, ConversationRow>()
  private readonly messageRows = new Map<string, MessageRow>()
  private readonly flagRows = new Map<string, FlagRow>()
  private events: BehaviouralEventRow[] = []

  constructor(now: () => Date = () => new Date()) {
    this.now = now
  }

  // --- Health ---------------------------------------------------------------

  ping(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true })
  }

  // --- Parent accounts ------------------------------------------------------

  createUser(input: UserInsert): Promise<string> {
    const id = input.id
    this.users.set(id, {
      id,
      name: input.name,
      email: input.email,
      emailVerified: input.emailVerified ?? false,
      image: input.image ?? null,
      createdAt: input.createdAt ?? this.now(),
      updatedAt: input.updatedAt ?? this.now(),
      subscriptionStatus: input.subscriptionStatus ?? 'trial',
    })
    return Promise.resolve(id)
  }

  deleteUser(id: string): Promise<void> {
    this.users.delete(id)
    // Cascade the way the FKs would: children (and their dependents) + devices.
    for (const child of [...this.childRows.values()]) {
      if (child.parentId === id) this.removeChild(child.id)
    }
    for (const device of [...this.deviceRows.values()]) {
      if (device.parentId === id) this.deviceRows.delete(device.deviceToken)
    }
    return Promise.resolve()
  }

  private removeChild(childId: string): void {
    this.childRows.delete(childId)
    this.presetRows.delete(childId)
    for (let i = this.calibrationRows.length - 1; i >= 0; i--) {
      if (this.calibrationRows[i]?.childId === childId) this.calibrationRows.splice(i, 1)
    }
    for (const topic of [...this.topicRows.values()]) {
      if (topic.childId === childId) this.topicRows.delete(topic.id)
    }
    for (const convo of [...this.conversationRows.values()]) {
      if (convo.childId === childId) this.removeConversation(convo.id)
    }
    for (const flag of [...this.flagRows.values()]) {
      if (flag.childId === childId) this.flagRows.delete(flag.id)
    }
    this.events = this.events.filter((e) => e.childId !== childId)
  }

  private removeConversation(id: string): void {
    this.conversationRows.delete(id)
    for (const msg of [...this.messageRows.values()]) {
      if (msg.conversationId === id) this.messageRows.delete(msg.id)
    }
    for (const flag of [...this.flagRows.values()]) {
      if (flag.conversationId === id) this.flagRows.delete(flag.id)
    }
  }

  // --- Children -------------------------------------------------------------

  createChild(input: ChildInsert): Promise<ChildRow> {
    for (const existing of this.childRows.values()) {
      if (existing.username === input.username) {
        throw new Error('duplicate username') // mirror the unique constraint
      }
    }
    const row: ChildRow = {
      id: input.id ?? randomUUID(),
      parentId: input.parentId,
      displayName: input.displayName,
      username: input.username,
      passwordHash: input.passwordHash,
      pinHash: input.pinHash ?? null,
      mustChangePassword: input.mustChangePassword ?? true,
      presetName: input.presetName ?? 'early-learner',
      createdAt: input.createdAt ?? this.now(),
    }
    this.childRows.set(row.id, row)
    return Promise.resolve(row)
  }

  getChild(id: string): Promise<ChildRow | null> {
    return Promise.resolve(this.childRows.get(id) ?? null)
  }

  getChildByUsername(username: string): Promise<ChildRow | null> {
    for (const child of this.childRows.values()) {
      if (child.username === username) return Promise.resolve(child)
    }
    return Promise.resolve(null)
  }

  listChildrenByParent(parentId: string): Promise<ChildRow[]> {
    return Promise.resolve([...this.childRows.values()].filter((c) => c.parentId === parentId))
  }

  updateChild(id: string, patch: ChildUpdate): Promise<ChildRow | null> {
    const existing = this.childRows.get(id)
    if (!existing) return Promise.resolve(null)
    const updated: ChildRow = { ...existing, ...patch }
    this.childRows.set(id, updated)
    return Promise.resolve(updated)
  }

  // --- Presets --------------------------------------------------------------

  createPreset(input: PresetInsert): Promise<PresetRow> {
    const row: PresetRow = {
      id: input.id ?? randomUUID(),
      childId: input.childId,
      name: input.name,
      vocabularyLevel: input.vocabularyLevel ?? PRESET_SLIDER_DEFAULTS.vocabularyLevel,
      responseDepth: input.responseDepth ?? PRESET_SLIDER_DEFAULTS.responseDepth,
      answeringStyle: input.answeringStyle ?? PRESET_SLIDER_DEFAULTS.answeringStyle,
      interactionMode: input.interactionMode ?? PRESET_SLIDER_DEFAULTS.interactionMode,
      topicAccess: input.topicAccess ?? PRESET_SLIDER_DEFAULTS.topicAccess,
      sessionLimits: input.sessionLimits ?? PRESET_SLIDER_DEFAULTS.sessionLimits,
      parentVisibility: input.parentVisibility ?? PRESET_SLIDER_DEFAULTS.parentVisibility,
      createdAt: input.createdAt ?? this.now(),
      updatedAt: input.updatedAt ?? this.now(),
    }
    this.presetRows.set(row.childId, row)
    return Promise.resolve(row)
  }

  getPresetByChild(childId: string): Promise<PresetRow | null> {
    return Promise.resolve(this.presetRows.get(childId) ?? null)
  }

  updatePreset(childId: string, patch: PresetSliderPatch): Promise<PresetRow | null> {
    const existing = this.presetRows.get(childId)
    if (!existing) return Promise.resolve(null)
    const updated: PresetRow = { ...existing, ...patch, updatedAt: this.now() }
    this.presetRows.set(childId, updated)
    return Promise.resolve(updated)
  }

  // --- Calibration ----------------------------------------------------------

  createCalibrationAnswers(childId: string, answers: CalibrationAnswerInput[]): Promise<void> {
    for (const a of answers) {
      this.calibrationRows.push({ id: randomUUID(), childId, ...a })
    }
    return Promise.resolve()
  }

  listCalibrationAnswers(childId: string): Promise<CalibrationRow[]> {
    return Promise.resolve(this.calibrationRows.filter((a) => a.childId === childId))
  }

  replaceCalibrationAnswers(
    childId: string,
    answers: CalibrationAnswerInput[],
  ): Promise<CalibrationRow[]> {
    for (let i = this.calibrationRows.length - 1; i >= 0; i--) {
      if (this.calibrationRows[i]?.childId === childId) this.calibrationRows.splice(i, 1)
    }
    for (const a of answers) {
      this.calibrationRows.push({ id: randomUUID(), childId, ...a })
    }
    return Promise.resolve(this.calibrationRows.filter((a) => a.childId === childId))
  }

  // --- Devices --------------------------------------------------------------

  getDeviceByToken(deviceToken: string): Promise<DeviceRow | null> {
    return Promise.resolve(this.deviceRows.get(deviceToken) ?? null)
  }

  createDevice(input: DeviceInsert): Promise<DeviceRow> {
    const row: DeviceRow = {
      id: input.id ?? randomUUID(),
      parentId: input.parentId,
      deviceToken: input.deviceToken,
      registeredAt: input.registeredAt ?? this.now(),
      lastUsed: input.lastUsed ?? this.now(),
    }
    this.deviceRows.set(row.deviceToken, row)
    return Promise.resolve(row)
  }

  // --- Parent-seeded topics -------------------------------------------------

  listParentSeededTopics(childId: string): Promise<ParentSeededTopicRow[]> {
    return Promise.resolve(
      [...this.topicRows.values()]
        .filter((t) => t.childId === childId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    )
  }

  createParentSeededTopic(childId: string, topic: string): Promise<ParentSeededTopicRow> {
    const row: ParentSeededTopicRow = {
      id: randomUUID(),
      childId,
      topic,
      createdAt: this.now(),
    }
    this.topicRows.set(row.id, row)
    return Promise.resolve(row)
  }

  deleteParentSeededTopic(topicId: string): Promise<void> {
    this.topicRows.delete(topicId)
    return Promise.resolve()
  }

  // --- Conversations --------------------------------------------------------

  createConversation(input: ConversationInsert): Promise<ConversationRow> {
    const row: ConversationRow = {
      id: input.id ?? randomUUID(),
      childId: input.childId,
      title: input.title ?? null,
      summary: input.summary ?? null,
      createdAt: input.createdAt ?? this.now(),
      updatedAt: input.updatedAt ?? this.now(),
    }
    this.conversationRows.set(row.id, row)
    return Promise.resolve(row)
  }

  getConversation(id: string): Promise<ConversationRow | null> {
    return Promise.resolve(this.conversationRows.get(id) ?? null)
  }

  listConversationsByChild(childId: string): Promise<ConversationRow[]> {
    return Promise.resolve(
      [...this.conversationRows.values()]
        .filter((c) => c.childId === childId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    )
  }

  deleteConversation(id: string): Promise<void> {
    this.removeConversation(id)
    return Promise.resolve()
  }

  touchConversation(id: string): Promise<void> {
    const existing = this.conversationRows.get(id)
    if (existing) this.conversationRows.set(id, { ...existing, updatedAt: this.now() })
    return Promise.resolve()
  }

  summariseAndPurgeConversation(id: string, summary: string): Promise<void> {
    const existing = this.conversationRows.get(id)
    if (existing) this.conversationRows.set(id, { ...existing, summary })
    for (const msg of [...this.messageRows.values()]) {
      if (msg.conversationId === id) this.messageRows.delete(msg.id)
    }
    return Promise.resolve()
  }

  // --- Messages -------------------------------------------------------------

  addMessage(input: MessageInsert): Promise<MessageRow> {
    const row: MessageRow = {
      id: input.id ?? randomUUID(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      flagged: input.flagged ?? false,
      createdAt: input.createdAt ?? this.now(),
    }
    this.messageRows.set(row.id, row)
    return Promise.resolve(row)
  }

  listMessages(conversationId: string): Promise<MessageRow[]> {
    return Promise.resolve(
      [...this.messageRows.values()]
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    )
  }

  countMessagesByConversations(conversationIds: string[]): Promise<number> {
    const ids = new Set(conversationIds)
    return Promise.resolve(
      [...this.messageRows.values()].filter((m) => ids.has(m.conversationId)).length,
    )
  }

  // --- Flags ----------------------------------------------------------------

  createFlag(input: FlagInsert): Promise<FlagRow> {
    const row: FlagRow = {
      id: input.id ?? randomUUID(),
      childId: input.childId,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      type: input.type,
      reason: input.reason,
      childMessage: input.childMessage ?? null,
      aiResponse: input.aiResponse ?? null,
      topics: input.topics ?? null,
      reviewed: input.reviewed ?? false,
      createdAt: input.createdAt ?? this.now(),
    }
    this.flagRows.set(row.id, row)
    return Promise.resolve(row)
  }

  getFlag(id: string): Promise<FlagRow | null> {
    return Promise.resolve(this.flagRows.get(id) ?? null)
  }

  listFlagsByChild(childId: string): Promise<FlagRow[]> {
    return Promise.resolve(this.sortedFlags((f) => f.childId === childId))
  }

  listFlagsByChildren(childIds: string[]): Promise<FlagRow[]> {
    const ids = new Set(childIds)
    return Promise.resolve(this.sortedFlags((f) => ids.has(f.childId)))
  }

  private sortedFlags(predicate: (f: FlagRow) => boolean): FlagRow[] {
    return [...this.flagRows.values()]
      .filter(predicate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  setFlagReviewed(id: string, reviewed: boolean): Promise<FlagRow | null> {
    const existing = this.flagRows.get(id)
    if (!existing) return Promise.resolve(null)
    const updated: FlagRow = { ...existing, reviewed }
    this.flagRows.set(id, updated)
    return Promise.resolve(updated)
  }

  // --- Behavioural events ---------------------------------------------------

  recordBehaviouralEvent(input: BehaviouralEventInsert): Promise<void> {
    this.events.push({
      id: input.id ?? randomUUID(),
      childId: input.childId ?? null,
      deviceToken: input.deviceToken ?? null,
      kind: input.kind,
      createdAt: input.createdAt ?? this.now(),
    })
    return Promise.resolve()
  }

  countBehaviouralEvents(opts: {
    kind: string
    since: Date
    childId?: string
    deviceToken?: string
  }): Promise<number> {
    return Promise.resolve(
      this.events.filter(
        (e) =>
          e.kind === opts.kind &&
          e.createdAt.getTime() >= opts.since.getTime() &&
          (opts.childId === undefined || e.childId === opts.childId) &&
          (opts.deviceToken === undefined || e.deviceToken === opts.deviceToken),
      ).length,
    )
  }

  pruneBehaviouralEvents(opts: {
    childId?: string
    deviceToken?: string
    before: Date
  }): Promise<void> {
    this.events = this.events.filter((e) => {
      const stale = e.createdAt.getTime() < opts.before.getTime()
      if (opts.childId !== undefined && stale && e.childId === opts.childId) return false
      if (opts.deviceToken !== undefined && stale && e.deviceToken === opts.deviceToken) {
        return false
      }
      return true
    })
    return Promise.resolve()
  }
}
