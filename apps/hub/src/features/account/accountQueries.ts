/** One spelling of the two keys the account screens read and invalidate. */
export const familyQueryKeys = {
  me: ['family', 'me'] as const,
  children: ['family', 'children'] as const,
}

export const SERVICE_DOWN = 'The family service is not answering. Try again in a moment.'
