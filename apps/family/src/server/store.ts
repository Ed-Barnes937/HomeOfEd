import type { DbClient } from '@hoe/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { childProfiles, type FamilySchema, saves, user } from './schema.ts'

export type ChildProfileRow = typeof childProfiles.$inferSelect

export interface ChildProfileInput {
  parentId: string
  username: string
  displayName: string
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

  addChildProfile(input: ChildProfileInput): Promise<ChildProfileRow>
  listChildProfiles(parentId: string): Promise<ChildProfileRow[]>
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
    await this.db.select({ ok: sql<number>`1` }).from(user).limit(1)
    return { ok: true }
  }

  async addChildProfile(input: ChildProfileInput): Promise<ChildProfileRow> {
    return first(await this.db.insert(childProfiles).values(input).returning())
  }

  listChildProfiles(parentId: string): Promise<ChildProfileRow[]> {
    return this.db
      .select()
      .from(childProfiles)
      .where(eq(childProfiles.parentId, parentId))
      .orderBy(childProfiles.createdAt)
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
