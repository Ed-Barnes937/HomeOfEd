/** The design's date line: "Tue 11 Aug" (en-GB short forms, no comma). */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
