import { ConflictError } from '@hoe/backend-kit'
import type { DbClient } from '@hoe/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { childProfiles, type FamilySchema, saves, user } from './schema.ts'

export type ChildProfileRow = typeof childProfiles.$inferSelect
export type ParentRow = typeof user.$inferSelect

export interface ChildProfileInput {
  parentId: string
  username: string
  displayName: string
}

export interface RenameChildProfileInput {
  id: string
  parentId: string
  displayName: string
}

/** A profile addressed by its id and the parent who must own it. */
export interface OwnedChildProfile {
  id: string
  parentId: string
}

/** One save slot, addressed exactly as the schema's primary key does. */
export interface SaveKey {
  appId: string
  accountId: string
  slotKey: string
}

export interface SaveRecord {
  blob: string
  version: number
  updatedAt: Date
}

/** Slot metadata for `save.list` - deliberately blob-free. */
export interface SaveSlot {
  slotKey: string
  version: number
  sizeBytes: number
  updatedAt: Date
}

/**
 * family's Store interface - its whole server-side query surface. Handlers
 * depend on this; "real vs simulator" is just the injected DbClient's driver.
 * Ownership checks live in handlers: every method here takes explicit ids.
 */
export interface FamilyStore {
  /** Deep liveness: a real round-trip used by the health check. */
  ping(): Promise<{ ok: true }>

  /** The Better Auth user row behind a session; null when it has gone. */
  getParent(id: string): Promise<ParentRow | null>

  /** Throws `ConflictError` when the username is taken; `username` is unique. */
  addChildProfile(input: ChildProfileInput): Promise<ChildProfileRow>
  listChildProfiles(parentId: string): Promise<ChildProfileRow[]>
  getChildProfile(id: string): Promise<ChildProfileRow | null>
  /** Owner-scoped: null when the profile is not this parent's. */
  renameChildProfile(input: RenameChildProfileInput): Promise<ChildProfileRow | null>
  /**
   * Erase one profile and every save row it owns, in one transaction.
   * `saves.accountId` has no FK, so a bare profile delete would strand them.
   */
  deleteChildProfile(profile: OwnedChildProfile): Promise<void>
  /** Erase a household: the parent, its profiles, and every save row they own. */
  deleteAccount(parentId: string): Promise<void>

  getSave(key: SaveKey): Promise<SaveRecord | null>
  /** Unconditional overwrite (LWW per slot); the version is bumped server-side. */
  putSave(input: SaveKey & { blob: string }): Promise<{ version: number }>
  listSaves(input: { appId: string; accountId: string }): Promise<SaveSlot[]>
  deleteSave(key: SaveKey): Promise<void>
}

// `.returning()` always yields a row after an insert, but the compiler can't
// know that under noUncheckedIndexedAccess.
function first<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (row === undefined) {
    throw new Error('expected at least one returned row')
  }
  return row
}

const UNIQUE_VIOLATION = '23505'

// Drizzle wraps driver errors, so the SQLSTATE sits on `cause`; `pg` and PGlite
// both put it there, and the bare form is checked in case a driver stops.
function isUniqueViolation(err: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === 'object' && value !== null ? (value as { code?: unknown }).code : undefined
  const cause =
    typeof err === 'object' && err !== null ? (err as { cause?: unknown }).cause : undefined
  return codeOf(err) === UNIQUE_VIOLATION || codeOf(cause) === UNIQUE_VIOLATION
}

function slotFilter(key: SaveKey) {
  return and(
    eq(saves.appId, key.appId),
    eq(saves.accountId, key.accountId),
    eq(saves.slotKey, key.slotKey),
  )
}

export class DrizzleFamilyStore implements FamilyStore {
  private readonly db: DbClient<FamilySchema>

  constructor(db: DbClient<FamilySchema>) {
    this.db = db
  }

  async ping(): Promise<{ ok: true }> {
    await this.db
      .select({ ok: sql<number>`1` })
      .from(user)
      .limit(1)
    return { ok: true }
  }

  async getParent(id: string): Promise<ParentRow | null> {
    const rows = await this.db.select().from(user).where(eq(user.id, id))
    return rows[0] ?? null
  }

  async addChildProfile(input: ChildProfileInput): Promise<ChildProfileRow> {
    try {
      return first(await this.db.insert(childProfiles).values(input).returning())
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError('that username is already taken')
      throw err
    }
  }

  listChildProfiles(parentId: string): Promise<ChildProfileRow[]> {
    return this.db
      .select()
      .from(childProfiles)
      .where(eq(childProfiles.parentId, parentId))
      .orderBy(childProfiles.createdAt)
  }

  async getChildProfile(id: string): Promise<ChildProfileRow | null> {
    const rows = await this.db.select().from(childProfiles).where(eq(childProfiles.id, id))
    return rows[0] ?? null
  }

  async renameChildProfile(input: RenameChildProfileInput): Promise<ChildProfileRow | null> {
    const rows = await this.db
      .update(childProfiles)
      .set({ displayName: input.displayName })
      .where(and(eq(childProfiles.id, input.id), eq(childProfiles.parentId, input.parentId)))
      .returning()
    return rows[0] ?? null
  }

  async deleteChildProfile(profile: OwnedChildProfile): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Owner-scoped, and the saves delete only follows a profile this parent
      // really owned - otherwise a foreign id would wipe that account's saves.
      const deleted = await tx
        .delete(childProfiles)
        .where(and(eq(childProfiles.id, profile.id), eq(childProfiles.parentId, profile.parentId)))
        .returning({ id: childProfiles.id })
      if (deleted.length === 0) return
      await tx.delete(saves).where(eq(saves.accountId, profile.id))
    })
  }

  async deleteAccount(parentId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const profiles = await tx
        .select({ id: childProfiles.id })
        .from(childProfiles)
        .where(eq(childProfiles.parentId, parentId))
      const accountIds = [parentId, ...profiles.map((profile) => profile.id)]

      await tx.delete(saves).where(inArray(saves.accountId, accountIds))
      await tx.delete(user).where(eq(user.id, parentId))
    })
  }

  async getSave(key: SaveKey): Promise<SaveRecord | null> {
    const rows = await this.db
      .select({ blob: saves.blob, version: saves.version, updatedAt: saves.updatedAt })
      .from(saves)
      .where(slotFilter(key))
    return rows[0] ?? null
  }

  async putSave(input: SaveKey & { blob: string }): Promise<{ version: number }> {
    const sizeBytes = new TextEncoder().encode(input.blob).length
    const rows = await this.db
      .insert(saves)
      .values({ ...input, sizeBytes })
      .onConflictDoUpdate({
        target: [saves.appId, saves.accountId, saves.slotKey],
        set: {
          blob: input.blob,
          sizeBytes,
          version: sql`${saves.version} + 1`,
          // The database clock, matching the insert path's defaultNow().
          updatedAt: sql`now()`,
        },
      })
      .returning({ version: saves.version })
    return { version: first(rows).version }
  }

  listSaves(input: { appId: string; accountId: string }): Promise<SaveSlot[]> {
    return this.db
      .select({
        slotKey: saves.slotKey,
        version: saves.version,
        sizeBytes: saves.sizeBytes,
        updatedAt: saves.updatedAt,
      })
      .from(saves)
      .where(and(eq(saves.appId, input.appId), eq(saves.accountId, input.accountId)))
      .orderBy(saves.slotKey)
  }

  async deleteSave(key: SaveKey): Promise<void> {
    await this.db.delete(saves).where(slotFilter(key))
  }
}
