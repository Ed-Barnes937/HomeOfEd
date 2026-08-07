/**
 * Playful, collision-free names for a freshly saved groove (spec: "Save
 * action ... a generated playful name — no typing required"; design handoff
 * §4/§5 examples: "Groove 1", "Groove 2", "Groove 3"). Pure: given the names
 * already in "My grooves", picks the lowest free "Groove N".
 */
export function generateGrooveName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames)
  let n = existingNames.length + 1
  while (taken.has(`Groove ${n}`)) n++
  return `Groove ${n}`
}
