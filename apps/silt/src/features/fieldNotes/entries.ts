/**
 * Field notes' shared brain: the interaction graph turned into *entries* - the
 * countable, witnessable units of the discovery metagame (spec §1, §2, §6).
 * Pure and DOM-free, no storage: the panel, the rail unlock, the moments and
 * the progression store all read this, so none of them can disagree about what
 * an entry is.
 *
 * Three rules do most of the work here:
 *
 * - **Species are charted, not listed** (spec §1, ticket 08). The sim's unit is
 *   a species, because a byte needs an owner (ADR 0043); the player's unit is an
 *   element. So the graph's `chartAs` is folded in as the entries are built:
 *   `buried` counts as seed, the plant's parts as flower, and the raw edges that
 *   land on the same charted key become one entry backed by several. It happens
 *   here, at the seam every consumer already reads, rather than in five places
 *   downstream - and never in the sim, whose reports and stored keys stay raw.
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
  chartedKey,
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
 * One raw edge behind a charted entry: the key the sim reports and the store
 * holds, and what that particular edge leaves behind (charted). Discovery reads
 * these rather than the entry's own products, because an element is discovered
 * by the transmutation the player actually saw (spec §1) - witnessing
 * `fire + stalk`, which leaves fire, must not reveal the steam that
 * `fire + sprout` leaves.
 */
export interface EntrySource {
  key: EdgeKey
  products: readonly string[]
}

/**
 * One witnessable interaction, in the player's vocabulary. `reagents` are the
 * elements that must meet; `products` are what the interaction can leave
 * behind, `empty` stripped and duplicates collapsed - so a pair that consumes
 * both cells has none, and `wood + ember -> ember / ember` has one.
 *
 * `sources` is what makes an entry a *charted* entry (ticket 08): most have
 * exactly one, but `acid + flower` is backed by the five raw edges acid has
 * with the plant's parts. The entry is witnessed when any of them has fired,
 * and mastered only when all of them have (decision 1).
 */
export interface Entry {
  key: EdgeKey
  kind: EdgeKind
  reagents: readonly string[]
  products: readonly string[]
  sources: readonly EntrySource[]
}

/** An entry before charting: one edge of the graph, in the sim's own names. */
type RawEntry = Omit<Entry, 'sources'>

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
  /** Every charted entry: reactions, then decays, then growth, then the hook transmutations. */
  all: readonly Entry[]
  /** `all`'s keys, same order. Its length is the chart's own denominator. */
  keys: readonly EdgeKey[]
  /** Every raw edge key behind them - the set the witness recorder may report. */
  witnessKeys: readonly EdgeKey[]
  /** Charted element names, in roster order. */
  elements: readonly string[]
  /** The elements known from first launch: whatever sits in the rail today. */
  preKnown: readonly string[]
  /** The charted entry a key names - charted or raw alike - or `undefined` for one this roster does not know. */
  get(key: EdgeKey): Entry | undefined
  /** The one definition of "an entry": reagent *or* product. Unknown keys are false. */
  involves(key: EdgeKey, elementName: string): boolean
  /** Whether any raw edge behind `key`'s entry has fired (ticket 08, decision 1). */
  isWitnessed(key: EdgeKey, witnessed: ReadonlySet<EdgeKey>): boolean
  /** The charted keys involving an element, in `all` order. Its length is the denominator. */
  entriesFor(elementName: string): readonly EdgeKey[]
  /** The raw keys behind those entries: what a witnessed set must hold to master it. */
  witnessKeysFor(elementName: string): readonly EdgeKey[]
  /** Minimum transmutation depth from the rail: pre-knowns 0, their products 1, and so on. */
  tierOf(elementName: string): number | undefined
  /** Everything a witnessed-key set implies. Unknown keys are ignored, never an error. */
  derive(witnessed: ReadonlySet<EdgeKey>): Discoveries
}

/** Strips cleared cells and collapses duplicates: `fire / fire` produces one product. */
function productsOf(...becomes: readonly string[]): readonly string[] {
  return [...new Set(becomes.filter((name) => name !== CLEARED))]
}

function entriesOf(graph: InteractionGraph): readonly RawEntry[] {
  const entries: RawEntry[] = graph.reactions.map((edge) => ({
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
 * The raw edges folded onto the charted elements they belong to (ticket 08):
 * every name rewritten through `chartAs`, the key recomputed from the charted
 * names, and edges that land on the same key collected into one entry.
 *
 * Two things this deliberately does not do. It does not drop an edge that
 * becomes a self-loop - the raise and the bloom stay as charted stage entries
 * under flower, so the plant's life cycle is still a story to be found one step
 * at a time (decision 2). And it does not lose which raw edge left what: the
 * entry's `products` is what the pair can leave, while each source keeps its
 * own, which is what discovery is derived from.
 */
function chartEntries(
  raw: readonly RawEntry[],
  charted: (name: string) => string,
): readonly Entry[] {
  /** An entry still collecting the raw edges that land on its key. */
  interface Collecting {
    key: EdgeKey
    kind: EdgeKind
    reagents: string[]
    products: string[]
    sources: EntrySource[]
  }
  const byKey = new Map<EdgeKey, Collecting>()

  for (const entry of raw) {
    const key = chartedKey(entry.key, charted)
    const products = [...new Set(entry.products.map(charted))]
    const reagents = [...new Set(entry.reagents.map(charted))]

    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        key,
        kind: entry.kind,
        reagents,
        products: [...products],
        sources: [{ key: entry.key, products }],
      })
      continue
    }

    // Merged edges agree on their reagents wherever the key was built from them,
    // but neither reagents nor outcome are guaranteed to: fire burns a tip and
    // steams a sprout, and a hook keys on its own name rather than what it
    // consumes. The entry has to be able to say all of it.
    for (const name of reagents) {
      if (!existing.reagents.includes(name)) existing.reagents.push(name)
    }
    for (const name of products) {
      if (!existing.products.includes(name)) existing.products.push(name)
    }
    existing.sources.push({ key: entry.key, products })
  }

  return [...byKey.values()]
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
  // The one place the mapping is read: every name below, and every key inside
  // `chartEntries`, goes through it.
  const charted = (name: string): string => graph.chartAs.get(name) ?? name

  const all = chartEntries(entriesOf(graph), charted)
  const keys = all.map((entry) => entry.key)
  const witnessKeys = all.flatMap((entry) => entry.sources.map((source) => source.key))
  // Charted, so a species the chart does not name is not a node: the picker
  // shows what the player can hold, and its tile comes from that element's own
  // def, which is why the mapping only ever points at a real element.
  const elements = [...new Set(graph.nodes.map((node) => charted(node.name)))]
  const preKnown = [
    ...new Set(graph.nodes.filter((node) => node.paintable).map((node) => charted(node.name))),
  ]

  // Keyed by the charted key *and* by every raw key behind it, so a witness the
  // sim reports lands on its entry without the caller knowing about the fold.
  const byKey = new Map<EdgeKey, Entry>()
  const bySource = new Map<EdgeKey, EntrySource>()
  const byElement = new Map<string, EdgeKey[]>(elements.map((name) => [name, []]))
  for (const entry of all) {
    byKey.set(entry.key, entry)
    for (const source of entry.sources) {
      byKey.set(source.key, entry)
      bySource.set(source.key, source)
    }
    for (const name of new Set([...entry.reagents, ...entry.products])) {
      byElement.get(name)?.push(entry.key)
    }
  }

  const tiers = tiersOf(all, preKnown)

  const entriesFor = (elementName: string): readonly EdgeKey[] => byElement.get(elementName) ?? []

  const witnessKeysFor = (elementName: string): readonly EdgeKey[] =>
    entriesFor(elementName).flatMap((key) => byKey.get(key)!.sources.map((source) => source.key))

  const isWitnessed = (key: EdgeKey, witnessed: ReadonlySet<EdgeKey>): boolean =>
    byKey.get(key)?.sources.some((source) => witnessed.has(source.key)) ?? false

  const derive = (witnessed: ReadonlySet<EdgeKey>): Discoveries => {
    const discovered = new Set(preKnown)
    for (const key of witnessed) {
      // The witnessed set holds raw keys, so discovery is what the player
      // actually saw happen - a grouped entry does not reveal the outcomes of
      // the edges behind it that have not fired. Unknown keys - a roster that
      // has moved on, or a hand-edited blob - are ignored rather than rejected
      // (spec §5, forward-compat).
      for (const product of bySource.get(key)?.products ?? []) discovered.add(product)
    }

    // Mastery is still every edge that names the element, raw ones included:
    // grouping removes the hunt for a fifth identical spoke, not the depth
    // (ticket 08, decision 1).
    const mastered = new Set(
      elements.filter((name) => {
        const owned = entriesFor(name)
        return (
          owned.length > 0 &&
          owned.every((key) => byKey.get(key)!.sources.every((source) => witnessed.has(source.key)))
        )
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
    witnessKeys,
    elements,
    preKnown,
    get: (key) => byKey.get(key),
    involves: (key, elementName) => {
      const entry = byKey.get(key)
      if (!entry) return false
      return entry.reagents.includes(elementName) || entry.products.includes(elementName)
    },
    isWitnessed,
    entriesFor,
    witnessKeysFor,
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
