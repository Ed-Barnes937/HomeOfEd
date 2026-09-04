/**
 * Field notes' edge-key codec, and nothing else. Split out of `entries.ts` so
 * the sim's reporting edge can map a witness event to a key without dragging
 * the graph derivation (and, through it, the palette) into the worker bundle:
 * this module imports one type and no module at all.
 *
 * **Edge identity is name-based and canonical** (spec §2): `react:acid+wood`
 * with the two names sorted, `decay:fire`, `grow:moss`, and since ticket 07 the
 * hook transmutations `germinate:moss`, `raise:sprout`, `bloom:tip`. Names, not
 * ids, because names are already the stable identity the scene codec persists.
 */
import type { WitnessEvent } from '../../sim/index.ts'

/** A canonical, name-based edge id: `react:<a>+<b>`, `decay:<from>`, `grow:<grower>`, `<hook kind>:<name>`. */
export type EdgeKey = string

/**
 * The hook transmutations (ticket 07). `germinate` is keyed by the *plant that
 * came up* - one site, two entries - while `raise` and `bloom` are keyed by the
 * cell that transmuted, as `grow` is by the grower.
 */
export type HookEdgeKind = 'germinate' | 'raise' | 'bloom'

export type EdgeKind = 'react' | 'decay' | 'grow' | HookEdgeKind

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

/** The key for a hook transmutation: `germinate:moss`, `raise:sprout`, `bloom:tip`. */
export function hookKey(kind: HookEdgeKind, name: string): EdgeKey {
  return `${kind}:${name}`
}

/**
 * The same key with every element name in it put through `charted` (discovery
 * ticket 08). The format is this module's business, and a charted key is an
 * ordinary key over the charted names - `react:lava+stalk` becomes
 * `react:flower+lava`, re-sorted, and `bloom:tip` becomes `bloom:flower`.
 *
 * Only ever called on keys this codec produced, which is why the two halves of
 * a reaction key can be taken as read. Note what this is *not*: the keys the
 * sim reports and the store holds are the raw ones, always. Charting happens on
 * the way into the view (`entries.ts`), so nothing stored has to migrate when
 * the mapping changes.
 */
export function chartedKey(key: EdgeKey, charted: (name: string) => string): EdgeKey {
  const separator = key.indexOf(':')
  const kind = key.slice(0, separator)
  const rest = key.slice(separator + 1)

  if (kind !== 'react') return `${kind}:${charted(rest)}`
  const [a, b] = rest.split('+')
  return reactionKey(charted(a!), charted(b!))
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
    case 'germinate':
    case 'raise':
    case 'bloom':
      return hookKey(event.kind, event.a)
  }
}
