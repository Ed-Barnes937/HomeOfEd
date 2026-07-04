import { Handler, type AppContext } from '@hoe/backend-kit'

import type { FridgeStore } from '../store.ts'

export interface HealthResult {
  ok: true
}

/**
 * Deep health: round-trips the Store (ADR 0010), so `/health` proves the app
 * can reach Postgres, not just that the process is up. Injected a fake in unit
 * tests; a real DrizzleFridgeStore in dev/prod/.iwft.
 */
export class HealthHandler extends Handler<void, HealthResult, FridgeStore> {
  async run(_input: void, ctx: AppContext<FridgeStore>): Promise<HealthResult> {
    ctx.logger.debug('health.run')
    return ctx.store.ping()
  }
}
