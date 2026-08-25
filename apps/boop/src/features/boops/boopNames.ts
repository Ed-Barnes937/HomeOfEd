/**
 * Playful, collision-free names for a freshly saved boop (spec: "Save
 * action ... a generated playful name — no typing required"; design handoff
 * §4/§5 examples: "Boop 1", "Boop 2", "Boop 3"). Pure: given the names
 * already in "My boops", picks the lowest free "Boop N" — starting the scan
 * at 1 rather than guessing from a count, so a pre-rename "Groove N" row (or
 * any other custom name) is a true non-candidate: it neither blocks a "Boop
 * N" slot nor inflates the next number away from it.
 */
export function generateBoopName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames)
  let n = 1
  while (taken.has(`Boop ${n}`)) n++
  return `Boop ${n}`
}
