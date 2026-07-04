import type { DbClient } from '@hoe/db'
import { eq } from 'drizzle-orm'

import type { StoredBoard } from './boardSchema.ts'
import { type FridgeSchema, sharedBoards } from './schema.ts'

/**
 * fridge's Store interface — its whole server-side query surface (ADR 0010).
 * Handlers depend on this; "real vs simulator" is just the injected DbClient's
 * driver. Only shared boards touch the DB; personal boards stay in
 * localStorage (plan §5).
 */
export interface FridgeStore {
  /** Deep liveness: a real round-trip used by the health check. */
  ping(): Promise<{ ok: true }>
  /**
   * Insert one immutable snapshot. Throws on primary-key (id) conflict — the
   * share handler catches that to retry with a fresh id.
   */
  insertSharedBoard(id: string, name: string, payload: StoredBoard): Promise<void>
  /** Fetch a snapshot by id, or null if it doesn't exist. */
  getSharedBoard(id: string): Promise<{ name: string; payload: StoredBoard } | null>
}

export class DrizzleFridgeStore implements FridgeStore {
  private readonly db: DbClient<FridgeSchema>

  constructor(db: DbClient<FridgeSchema>) {
    this.db = db
  }

  async ping(): Promise<{ ok: true }> {
    await this.db.select().from(sharedBoards).limit(1)
    return { ok: true }
  }

  async insertSharedBoard(id: string, name: string, payload: StoredBoard): Promise<void> {
    await this.db.insert(sharedBoards).values({ id, name, payload })
  }

  async getSharedBoard(id: string): Promise<{ name: string; payload: StoredBoard } | null> {
    const rows = await this.db
      .select({ name: sharedBoards.name, payload: sharedBoards.payload })
      .from(sharedBoards)
      .where(eq(sharedBoards.id, id))
      .limit(1)
    return rows[0] ?? null
  }
}
