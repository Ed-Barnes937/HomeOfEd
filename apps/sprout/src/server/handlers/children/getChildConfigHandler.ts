import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import { type ChildConfig, loadChildConfig } from './loadChildConfig.ts'

export const getChildConfigInputSchema = z.object({ childId: z.string().uuid() })
export type GetChildConfigInput = z.infer<typeof getChildConfigInputSchema>

export type { ChildConfig } from './loadChildConfig.ts'

/**
 * children.config — the child's guardrail sliders + calibration answers, for
 * the parent dashboard. Safe-by-default (6.5.9): a child with no preset row
 * falls back to the STRICTEST preset (early-learner), not the middle one.
 *
 * NB the chat SSE path (P5) loads this same config (via `loadChildConfig`) by
 * the authenticated child's own id server-side (#36); `children.myConfig` is
 * the child-scoped read for the client's session-limit gate.
 */
export class GetChildConfigHandler extends Handler<GetChildConfigInput, ChildConfig, SproutStore> {
  async run(input: GetChildConfigInput, ctx: AppContext<SproutStore>): Promise<ChildConfig> {
    const { child } = await verifyChildOwnership(ctx, input.childId)
    return loadChildConfig(ctx.store, child.id)
  }
}
