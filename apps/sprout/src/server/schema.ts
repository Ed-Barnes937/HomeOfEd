import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * sprout's single Drizzle schema (plan §6.1): the 9 app tables merged with the
 * 4 Better Auth tables into ONE schema, one drizzle.config, one migration
 * journal (plan D2). Ported from child-safe-llm's `packages/db/src/schema/*`
 * (app) and `apps/web/src/lib/auth-schema.ts` (auth).
 *
 * Two real foreign keys were ADDED here that the source lacked (plan §5.2):
 * `children.parentId` and `devices.parentId` were plain `text` in separate
 * migration domains; now that auth + app live in one schema they reference
 * `user.id` with `onDelete: 'cascade'` — deleting a parent account removes the
 * children/devices it owns (and everything that cascades from a child).
 *
 * Faithfulness note: the source stores flag topics as a JSON string in a `text`
 * column (`flags.topics`) and presets as integer sliders — there are NO true
 * jsonb columns in the source. They are ported as-is (text/integer), not
 * promoted to jsonb.
 */

// --- Better Auth tables (from apps/web/src/lib/auth-schema.ts) ---------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  subscriptionStatus: text('subscription_status').default('trial'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// --- App tables (from packages/db/src/schema/*) ------------------------------

export const children = pgTable('children', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Was plain `text` in the source; now a real FK to the parent account (§5.2).
  parentId: text('parent_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  pinHash: text('pin_hash'),
  // The child's initial password is its username (a weak default). This flag is
  // set on creation and cleared once the child sets a real password on first
  // login.
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  presetName: text('preset_name').notNull().default('early-learner'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const presets = pgTable('presets', {
  id: uuid('id').defaultRandom().primaryKey(),
  childId: uuid('child_id')
    .notNull()
    .unique()
    .references(() => children.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  vocabularyLevel: integer('vocabulary_level').notNull().default(1),
  responseDepth: integer('response_depth').notNull().default(1),
  answeringStyle: integer('answering_style').notNull().default(1),
  interactionMode: integer('interaction_mode').notNull().default(1),
  topicAccess: integer('topic_access').notNull().default(1),
  sessionLimits: integer('session_limits').notNull().default(3),
  parentVisibility: integer('parent_visibility').notNull().default(5),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Was plain `text` in the source; now a real FK to the parent account (§5.2).
  parentId: text('parent_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  deviceToken: text('device_token').notNull().unique(),
  registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsed: timestamp('last_used', { withTimezone: true }).defaultNow().notNull(),
})

export const calibrationAnswers = pgTable('calibration_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  childId: uuid('child_id')
    .notNull()
    .references(() => children.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull(),
  selectedLevel: integer('selected_level'), // null when custom answer provided
  customAnswer: text('custom_answer'), // non-null when parent writes their own
})

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  childId: uuid('child_id')
    .notNull()
    .references(() => children.id, { onDelete: 'cascade' }),
  title: text('title'),
  summary: text('summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // "child" | "ai"
  content: text('content').notNull(),
  flagged: boolean('flagged').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const flags = pgTable('flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  childId: uuid('child_id')
    .notNull()
    .references(() => children.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, {
    onDelete: 'cascade',
  }),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // "sensitive" | "blocked" | "validation-failed" | "reported"
  reason: text('reason').notNull(),
  childMessage: text('child_message'),
  aiResponse: text('ai_response'),
  topics: text('topics'), // JSON array of detected topic strings (stored as text)
  reviewed: boolean('reviewed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const parentSeededTopics = pgTable('parent_seeded_topics', {
  id: uuid('id').defaultRandom().primaryKey(),
  childId: uuid('child_id')
    .notNull()
    .references(() => children.id, { onDelete: 'cascade' }),
  // Length is also enforced server-side in the create handler.
  topic: varchar('topic', { length: 200 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// Append-only log of behavioural signals used for rate / velocity / probe
// limiting and basic device reputation. The pipeline owns no DB, so this state
// lives in the web app. Rows are pruned past the retention window by the
// rate-limit layer, so the table stays bounded.
export const behaviouralEvents = pgTable(
  'behavioural_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Nullable: a PIN brute-force attempt has a childId but a chat throttle may
    // be keyed only by device, and vice versa.
    childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }),
    deviceToken: text('device_token'),
    kind: text('kind').notNull(), // "message" | "probe" | "rate_violation" | "pin_fail"
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('behavioural_events_child_kind_created_idx').on(t.childId, t.kind, t.createdAt),
    index('behavioural_events_device_kind_created_idx').on(t.deviceToken, t.kind, t.createdAt),
  ],
)

export const sproutSchema = {
  user,
  session,
  account,
  verification,
  children,
  presets,
  devices,
  calibrationAnswers,
  conversations,
  messages,
  flags,
  parentSeededTopics,
  behaviouralEvents,
}

export type SproutSchema = typeof sproutSchema
