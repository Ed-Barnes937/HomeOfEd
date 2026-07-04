import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

/**
 * Fetch a shared snapshot by id (ADR 0010). `retry: false` so a NOT_FOUND (an
 * unknown/typo'd id) surfaces immediately as the not-found state instead of
 * being retried three times.
 */
export function sharedBoardQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['sharedBoard', id],
    queryFn: () => trpcClient.board.get.query({ id }),
    retry: false,
  })
}
