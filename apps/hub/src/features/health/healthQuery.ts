import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: () => trpcClient.health.query(),
})
