// Minimal classname joiner (replaces the source's clsx/tailwind-merge `cn`).
// Styling is P7 — this just concatenates truthy class fragments so components
// keep their (temporary) Tailwind-ish class strings without a runtime dep.
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
