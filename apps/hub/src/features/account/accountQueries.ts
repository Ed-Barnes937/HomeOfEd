/** One spelling of the keys the account screens read and invalidate. */
export const familyQueryKeys = {
  all: ['family'] as const,
  me: ['family', 'me'] as const,
  children: ['family', 'children'] as const,
}

/** Long enough for the page to reuse what silent renewal fetched; every change invalidates. */
export const FAMILY_STALE_MS = 5_000

export const SERVICE_DOWN = 'The family service is not answering. Try again in a moment.'
