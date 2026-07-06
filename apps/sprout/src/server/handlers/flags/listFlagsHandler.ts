import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { SproutStore } from '../../store.ts'
import { requireParent } from '../authz.ts'
import { toFlagRecord, type FlagRecord } from './schemas.ts'

// `childId` is accepted for shape-parity with the source's query param, but it
// is NEVER used to filter or to trust the caller — the owned-child set always
// comes from `ctx.auth` via `listChildrenByParent`. Ignoring the input (rather
// than validating it against ownership) is what closes the #35 IDOR here: a
// crafted childId can neither narrow nor widen what a parent sees.
export const listFlagsInputSchema = z.object({ childId: z.string().uuid().optional() }).optional()
export type ListFlagsInput = z.infer<typeof listFlagsInputSchema>

export interface FlagSummary extends FlagRecord {
  childDisplayName: string
}

/**
 * flags.list — every flag across every child the authenticated parent owns,
 * newest-first, with each child's display name resolved from the owned-child
 * set (never trusted from input).
 */
export class ListFlagsHandler extends Handler<ListFlagsInput, FlagSummary[], SproutStore> {
  async run(_input: ListFlagsInput, ctx: AppContext<SproutStore>): Promise<FlagSummary[]> {
    const parent = requireParent(ctx)
    const ownedChildren = await ctx.store.listChildrenByParent(parent.id)
    if (ownedChildren.length === 0) return []

    const displayNameById = new Map(ownedChildren.map((c) => [c.id, c.displayName]))
    const rows = await ctx.store.listFlagsByChildren(ownedChildren.map((c) => c.id))

    return rows.map((row) => ({
      ...toFlagRecord(row),
      childDisplayName: displayNameById.get(row.childId) ?? 'Unknown',
    }))
  }
}
