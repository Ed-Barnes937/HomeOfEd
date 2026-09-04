/**
 * Field notes' shared brain: the interaction graph turned into *entries* - the
 * countable, witnessable units of the discovery metagame (spec §1, §2, §6).
 * Pure and DOM-free, no storage: the panel, the rail unlock, the moments and
 * the progression store all read this, so none of them can disagree about what
 * an entry is.
 *
 * Two rules do most of the work here:
 *
 * - **Edge identity is name-based and canonical** (spec §2), which `edgeKeys.ts`
 *   owns and this module re-exports: `react:acid+wood` with the two names
 *   sorted, `decay:fire`, `grow:moss`. Names, not ids, because names are
 *   already the stable identity the scene codec persists.
 * - **One definition of "an entry"** (spec §6): an edge counts for an element
 *   when the element is a reagent *or* a product. `involves()` is that single
 *   predicate - the picker counts, the ring, the still-to-find footer and mud's
 *   unlock chip must all read it rather than re-deriving, since splitting it is
 *   exactly what empties the ring for a product-only element like obsidian.
 *
 * The graph comes from `src/docs/interactionGraph.ts` (the generator behind the
 * checked-in doc), never from re-reading the registry: one derivation, three
 * consumers. That module reads `PAINTABLE_IDS` at runtime, so everything below
 * is correct both before and after the rail trim - nothing here counts
 * paintables for itself.
 */
import { deriveInteractionGraph, type InteractionGraph } from '../../docs/interactionGraph.ts'
import {
  decayKey,
  growthKey,
  hookKey,
  reactionKey,
  type EdgeKey,
  type EdgeKind,
} from './edgeKeys.ts'

// The codec lives one module down (`edgeKeys.ts`) so the sim's reporting edge
// can reach it without the graph derivation, and is re-exported here because
// this is the module the rest of field notes reads.
export {
  decayKey,
  growthKey,
  hookKey,
  reactionKey,
  witnessedKey,
  type EdgeKey,
  type EdgeKind,
} from './edgeKeys.ts'

/** How the graph writes a cleared cell. Not an element, so never a product. */
const CLEARED = 'empty'

/**
 * One witnessable interaction. `reagents` are the elements that must meet;
 * `products` are what the interaction leaves behind, `empty` stripped and
 * duplicates collapsed - so a pair that consumes both cells has none, and
 * `wood + ember -> ember / ember` has one.
 */
export interface Entry {
  key: EdgeKey
  kind: EdgeKind
  reagents: readonly string[]
  products: readonly string[]
}

/** What a witnessed-key set implies. All derived, none of it stored (spec §5). */
export interface Discoveries {
  /** Pre-knowns, plus every element a witnessed entry names as a product. */
  discovered: ReadonlySet<string>
  /** Elements whose every entry has been witnessed. */
  mastered: ReadonlySet<string>
  /** Mastered unlockables, in `UNLOCKABLE_NAMES` order: these join the rail. */
  unlocked: readonly string[]
}

/**
 * Discoverable elements that join the paint rail once mastered (spec §1, §9.6).
 * Declared beside the derivation that consumes it so the two cannot drift.
 * v1 has exactly one: mud, whose five edges pull the player through the char
 * chain before it is earned.
 */
export const UNLOCKABLE_NAMES: readonly string[] = ['mud']

export interface EntryIndex {
  /** Every entry: reactions, then decays, then growth, then the hook transmutations. */
  all: readonly Entry[]
  /** `all`'s keys, same order - the set the witness recorder may report. */
  keys: readonly EdgeKey[]
  /** Element names in roster order. */
  elements: readonly string[]
  /** The elements known from first launch: whatever sits in the rail today. */
  preKnown: readonly string[]
  /** The entry a key names, or `undefined` for a key this roster does not know. */
  get(key: EdgeKey): Entry | undefined
  /** The one definition of "an entry": reagent *or* product. Unknown keys are false. */
  involves(key: EdgeKey, elementName: string): boolean
  /** The keys involving an element, in `all` order. Its length is the denominator. */
  entriesFor(elementName: string): readonly EdgeKey[]
  /** Minimum transmutation depth from the rail: pre-knowns 0, their products 1, and so on. */
  tierOf(elementName: string): number | undefined
  /** Everything a witnessed-key set implies. Unknown keys are ignored, never an error. */
  derive(witnessed: ReadonlySet<EdgeKey>): Discoveries
}

/** Strips cleared cells and collapses duplicates: `fire / fire` produces one product. */
function productsOf(...becomes: readonly string[]): readonly string[] {
  return [...new Set(becomes.filter((name) => name !== CLEARED))]
}

function entriesOf(graph: InteractionGraph): readonly Entry[] {
  const entries: Entry[] = graph.reactions.map((edge) => ({
    key: reactionKey(edge.a, edge.b),
    kind: 'react',
    reagents: edge.a <= edge.b ? [edge.a, edge.b] : [edge.b, edge.a],
    products: productsOf(edge.aBecomes, edge.bBecomes),
  }))

  for (const decay of graph.decays) {
    // A fade is not an entry and not a discovery (spec §1): smoke expiring
    // transmutes into nothing, so there is nothing to witness. A death drop
    // (`emits`, life ticket 04) rides on the decay it belongs to: the brood is
    // a product of the same entry, and it is what makes the entry an entry even
    // when the dying cell itself clears - petal has no other edge naming it as
    // a product, so dropping the brood here would make it undiscoverable.
    const emits = decay.emits?.species
    if (decay.becomes === CLEARED && emits === undefined) continue
    entries.push({
      key: decayKey(decay.from),
      kind: 'decay',
      reagents: [decay.from],
      products: emits === undefined ? productsOf(decay.becomes) : productsOf(decay.becomes, emits),
    })
  }

  for (const edge of graph.growth) {
    entries.push({
      key: growthKey(edge.grower),
      kind: 'grow',
      reagents: [edge.grower, edge.consumes],
      products: productsOf(edge.becomes),
    })
  }

  // The hook transmutations (ticket 07) arrive shaped as entries already:
  // reagents, products and the key's two halves are what the generator
  // declares, so nothing here re-derives them.
  for (const edge of graph.hooks) {
    entries.push({
      key: hookKey(edge.kind, edge.name),
      kind: edge.kind,
      reagents: edge.reagents,
      products: productsOf(...edge.products),
    })
  }

  return entries
}

/**
 * Minimum transmutation depth, to a fixed point over the entries that make
 * something. An element is one deeper than the deepest reagent of its
 * shallowest recipe, so vine (grown from moss, itself grown from mud) sits
 * behind moss rather than beside water. Iterating to a fixed point rather than
 * walking the graph is what makes the cycles safe - vine is a reagent of the
 * edge that makes vine.
 */
function tiersOf(entries: readonly Entry[], preKnown: readonly string[]): Map<string, number> {
  const tiers = new Map(preKnown.map((name) => [name, 0]))
  const productive = entries.filter((entry) => entry.products.length > 0)

  let settled = false
  while (!settled) {
    settled = true
    for (const entry of productive) {
      let deepest = 0
      for (const reagent of entry.reagents) {
        const tier = tiers.get(reagent)
        if (tier === undefined) {
          deepest = -1
          break
        }
        deepest = Math.max(deepest, tier)
      }
      if (deepest < 0) continue
      for (const product of entry.products) {
        const known = tiers.get(product)
        if (known !== undefined && known <= deepest + 1) continue
        tiers.set(product, deepest + 1)
        settled = false
      }
    }
  }

  return tiers
}

/** Builds the index off `graph` - the live one by default; a synthetic one in tests. */
export function buildEntryIndex(graph: InteractionGraph = deriveInteractionGraph()): EntryIndex {
  const all = entriesOf(graph)
  const keys = all.map((entry) => entry.key)
  const elements = graph.nodes.map((node) => node.name)
  const preKnown = graph.nodes.filter((node) => node.paintable).map((node) => node.name)

  const byKey = new Map(all.map((entry) => [entry.key, entry]))
  const byElement = new Map<string, EdgeKey[]>(elements.map((name) => [name, []]))
  for (const entry of all) {
    for (const name of new Set([...entry.reagents, ...entry.products])) {
      byElement.get(name)?.push(entry.key)
    }
  }

  const tiers = tiersOf(all, preKnown)

  const entriesFor = (elementName: string): readonly EdgeKey[] => byElement.get(elementName) ?? []

  const derive = (witnessed: ReadonlySet<EdgeKey>): Discoveries => {
    const discovered = new Set(preKnown)
    for (const key of witnessed) {
      // Unknown keys - a roster that has moved on, or a hand-edited blob - are
      // ignored rather than rejected (spec §5, forward-compat).
      for (const product of byKey.get(key)?.products ?? []) discovered.add(product)
    }

    const mastered = new Set(
      elements.filter((name) => {
        const owned = entriesFor(name)
        return owned.length > 0 && owned.every((key) => witnessed.has(key))
      }),
    )

    return {
      discovered,
      mastered,
      unlocked: UNLOCKABLE_NAMES.filter((name) => mastered.has(name)),
    }
  }

  return {
    all,
    keys,
    elements,
    preKnown,
    get: (key) => byKey.get(key),
    involves: (key, elementName) => {
      const entry = byKey.get(key)
      if (!entry) return false
      return entry.reagents.includes(elementName) || entry.products.includes(elementName)
    },
    entriesFor,
    tierOf: (elementName) => tiers.get(elementName),
    derive,
  }
}

let memoized: EntryIndex | undefined

/**
 * The index for the live roster, built once. The graph derivation asks the
 * registry for every ordered pair, so rebuilding it per render would be waste;
 * nothing here is mutable, so one instance is safe to share.
 */
export function entryIndex(): EntryIndex {
  return (memoized ??= buildEntryIndex())
}
