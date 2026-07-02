import type { DbClient } from '@hoe/db'

import { healthTable, type HubSchema } from './schema.ts'

/**
 * hub's own Store interface — its whole query surface. Handlers depend on
 * this; "real vs simulator" is just the injected DbClient's driver.
 */
export interface HealthStore {
  ping(): Promise<{ ok: true; value: string }>
}

export class DrizzleHealthStore implements HealthStore {
  private readonly db: DbClient<HubSchema>

  constructor(db: DbClient<HubSchema>) {
    this.db = db
  }

  async ping(): Promise<{ ok: true; value: string }> {
    const rows = await this.db.select().from(healthTable).limit(1)
    return { ok: true, value: rows[0]?.value ?? '(health table empty)' }
  }
}
