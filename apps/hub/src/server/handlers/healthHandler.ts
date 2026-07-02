import { Handler, type AppContext } from '@hoe/backend-kit'

import type { HealthStore } from '../store.ts'

export interface HealthResult {
  ok: true
  value: string
}

export class HealthHandler extends Handler<void, HealthResult, HealthStore> {
  async run(_input: void, ctx: AppContext<HealthStore>): Promise<HealthResult> {
    ctx.logger.debug('health.ping')
    return ctx.store.ping()
  }
}
