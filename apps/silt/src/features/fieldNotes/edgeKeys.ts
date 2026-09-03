/**
 * Field notes' edge-key codec, and nothing else. Split out of `entries.ts` so
 * the sim's reporting edge can map a witness event to a key without dragging
 * the graph derivation (and, through it, the palette) into the worker bundle:
 * this module imports one type and no module at all.
 *
 * **Edge identity is name-based and canonical** (spec §2): `react:acid+wood`
 * with the two names sorted, `decay:fire`, `grow:moss`. Names, not ids, because
 * names are already the stable identity the scene codec persists.
 */
import type { WitnessEvent } from '../../sim/index.ts'

/** A canonical, name-based edge id: `react:<a>+<b>`, `decay:<from>`, `grow:<grower>`. */
export type EdgeKey = string

export type EdgeKind = 'react' | 'decay' | 'grow'

/** The key for an unordered reaction pair; the two names are sorted. */
export function reactionKey(a: string, b: string): EdgeKey {
  return a <= b ? `react:${a}+${b}` : `react:${b}+${a}`
}

/** The key for a decay with a product. A fade has no entry, so no key is asked for. */
export function decayKey(from: string): EdgeKey {
  return `decay:${from}`
}

/** The key for a growth hook edge, named for the plant doing the growing. */
export function growthKey(grower: string): EdgeKey {
  return `grow:${grower}`
}

/**
 * The key for what the sim just witnessed. The sim reports the interaction and
 * names its elements, but deliberately knows nothing of this format - it sits
 * below field notes - so this is the one place the two vocabularies meet.
 */
export function witnessedKey(event: WitnessEvent): EdgeKey {
  switch (event.kind) {
    case 'react':
      return reactionKey(event.a, event.b)
    case 'decay':
      return decayKey(event.a)
    case 'grow':
      return growthKey(event.a)
  }
}
