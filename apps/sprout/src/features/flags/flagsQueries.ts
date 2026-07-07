// flags.* — parent flag-review surface (replaces `api/flags.ts` +
// `queries/flags.ts`). `flags.list` returns every flag across the parent's
// owned children (childId is NOT trusted server-side — #35); the per-child
// filter is applied CLIENT-side on this full owned set.
import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

export type FlagSummary = Awaited<ReturnType<typeof trpcClient.flags.list.query>>[number]

export const flagsQueryOptions = queryOptions({
  queryKey: ['flags'],
  queryFn: () => trpcClient.flags.list.query(),
})

export const reviewFlag = (flagId: string, reviewed: boolean) =>
  trpcClient.flags.review.mutate({ flagId, reviewed })
