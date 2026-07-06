import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

export const greetingQueryOptions = queryOptions({
  queryKey: ['greeting'],
  queryFn: () => trpcClient.greeting.query(),
})
