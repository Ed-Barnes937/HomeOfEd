/**
 * An app counts as "new" for two weeks after it went live. `now` is injected so
 * the rule is deterministic to unit-test; the component passes `new Date()`.
 * A missing/unparseable date, or a future one (not live yet), is never "new".
 */
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

export function isNew(deployedAt: string | undefined, now: Date): boolean {
  if (!deployedAt) return false
  const deployed = Date.parse(deployedAt)
  if (Number.isNaN(deployed)) return false
  const age = now.getTime() - deployed
  return age >= 0 && age < TWO_WEEKS_MS
}
