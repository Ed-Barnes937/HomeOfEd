import type { FamilyIdentityContract } from '@hoe/accounts'
import { queryOptions } from '@tanstack/react-query'

/** One spelling of the keys the account screens read and invalidate. */
export const familyQueryKeys = {
  all: ['family'] as const,
  me: ['family', 'me'] as const,
  children: ['family', 'children'] as const,
  saveSummary: ['family', 'saveSummary'] as const,
}

/** Long enough for the page to reuse what silent renewal fetched; every change invalidates. */
export const FAMILY_STALE_MS = 5_000

/** The one save-summary query; every row reads it. */
export function saveSummaryQuery(client: FamilyIdentityContract) {
  return queryOptions({
    queryKey: familyQueryKeys.saveSummary,
    queryFn: () => client.saveSummary(),
    staleTime: FAMILY_STALE_MS,
  })
}

export const SERVICE_DOWN = 'The family service is not answering. Try again in a moment.'
