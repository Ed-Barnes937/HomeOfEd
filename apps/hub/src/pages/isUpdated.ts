/**
 * An app counts as "updated" for two weeks after its last notable change went
 * live. Mirrors `isNew` (see isNew.ts): `now` is injected so the rule is
 * deterministic to unit-test, and a missing/unparseable date, or a future one
 * (not shipped yet), is never "updated".
 */
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

export function isUpdated(updatedAt: string | undefined, now: Date): boolean {
  if (!updatedAt) return false
  const updated = Date.parse(updatedAt)
  if (Number.isNaN(updated)) return false
  const age = now.getTime() - updated
  return age >= 0 && age < TWO_WEEKS_MS
}
