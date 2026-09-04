/**
 * The Field notes panel as data (spec §6): the picker's rows and one element's
 * ring, derived from the witnessed set and nothing else. Pure and DOM-free -
 * the panel component positions this and hands it to the tile helper, which is
 * why the ordering, the spoke model and the spoiler masking are vitest cases
 * rather than browser ones.
 *
 * Two rules shape everything here:
 *
 * - **One definition of "an entry"** (spec §6): `entriesFor()` is the only
 *   source of an element's edges, so the picker count, the ring, the
 *   still-to-find footer and mud's unlock chip cannot disagree. Re-deriving any
 *   one of them from the reagents alone is what empties the ring for a
 *   product-only element like obsidian.
 * - **Never name a hidden element** (spec §7): every name that reaches the DOM
 *   passes through `refOf`, so an element the player has not discovered reads
 *   as `- - -` wherever it appears - picker row, ring centre, spoke partner,
 *   outcome words and product tiles alike. It is not hypothetical: a scene saved
 *   before the rail trim can restore painted mud, and dropping lava on it
 *   witnesses `lava + mud` without mud ever having been discovered.
 */
import type { EdgeKey, EdgeKind } from './edgeKeys.ts'
import type { ElementTags } from './elementAppearance.ts'
import { entryIndex, type Entry, type EntryIndex } from './entries.ts'
import type { FieldNotesView } from './fieldNotesView.ts'

/** What an undiscovered element reads as, anywhere its name would go (spec §7). */
export const HIDDEN_NAME = '- - -'

/**
 * The sim tags a player is allowed to read (ticket 12), in the order they are
 * chipped. An allowlist rather than a pass-through, in this one place, because
 * the tags are engine vocabulary - the reaction table's keys - and a tag
 * invented for the roster tomorrow must not leak into the panel as jargon
 * without a decision here. The order is this array's, not the roster's, so wood
 * reads `[solid] [flammable]` whichever way its `tags` happen to be written.
 *
 * Every tag currently reads as itself, which is why this is a list and not a
 * tag -> word map: the day a tag needs a different word is the day the map
 * earns its shape.
 *
 * - The four archetype-ish tags are in. The tile shape already carries them
 *   (square, cut corners, diamond, hexagon), but a shape has no accessible
 *   name, and the word is what a screen reader has.
 * - `flammable` is the tag the ticket is really about: it is what the
 *   `fire + [flammable]` row keys on, so it is a hint the player can act on.
 * - **`energy` is in.** The call was left open in the ticket. It goes in
 *   because the paint rail already groups fire under a player-facing "Energy"
 *   heading (`features/palette/paletteGroups.ts`), so hiding the same word here
 *   would leave two surfaces disagreeing about one element; and unlike the
 *   other four it says something the hexagon does not - fire is a gas that
 *   burns things, not just a gas. It keys no reaction row today, which makes it
 *   the weakest chip on the list, not a wrong one.
 * - `wall` is out: it belongs to the out-of-bounds sentinel and names no
 *   element the player can ever reach.
 */
const TAG_CHIPS: readonly string[] = ['solid', 'powder', 'liquid', 'gas', 'energy', 'flammable']

/** The allowlisted tags of `raw`, in `TAG_CHIPS` order. Everything else is dropped. */
function chipsOf(raw: readonly string[]): readonly string[] {
  const declared = new Set(raw)
  return TAG_CHIPS.filter((tag) => declared.has(tag))
}

/** Separates the two reagents of the pair that makes the focused element. */
const REAGENT_JOIN = ' + '

/** Separates an entry's products, and the key's kinds sharing one stroke. */
const PRODUCT_JOIN = ' · '

/** What an entry that consumes both cells leaves behind (spec §6). */
const CONSUMED = 'both consumed'

/** An element as a tile: what to draw, and what it is allowed to be called. */
export interface ElementRef {
  name: string
  /** The name, or the mask when the element has not been discovered. */
  label: string
  /** Discovered elements are the only selectable ones. */
  discovered: boolean
  /**
   * The element's tag chips, already allowlisted and ordered (ticket 12).
   * **Absent unless the element has been discovered *and* the caller supplied a
   * tag source**, so a hidden element carries no tags at all. Only `ringFor`
   * supplies one, and only for the centre: the picker rows, the spoke partners
   * and the product tiles are drawn too small for words, so they carry none.
   */
  tags?: readonly string[]
}

export interface PickerRow extends ElementRef {
  /** Minimum transmutation depth: the column, and the sort key (spec §6). */
  tier: number
  /** `seen/total`, or `n/m to unlock` on an unearned unlockable. Empty while hidden. */
  count: string
  /** Every entry involving the element has been witnessed - the drawn star. */
  mastered: boolean
  /** Discovered since the panel was last closed - the green plate edge. */
  isNew: boolean
}

/** Which way a spoke's arrowhead points, if it has one. */
export type SpokeDirection =
  /** Into the centre: this pair is what makes the focused element. */
  | 'in'
  /** Out at the ring tile, which is the entry's product. */
  | 'out'
  /** An undirected reaction between two reagents. */
  | 'none'

export interface Spoke {
  key: EdgeKey
  kind: EdgeKind
  /** The element on the ring: the other reagent, or the first of the pair that makes the focus. */
  partner: ElementRef
  direction: SpokeDirection
  /** The words on the line, already masked. */
  outcome: string
  /** The outcome's own tiles, under the words. Tapping a discovered one follows it. */
  tiles: readonly ElementRef[]
}

export interface RingModel {
  centre: ElementRef
  /** One per **witnessed** entry, in entry order. Nothing else is ever drawn (spec §7). */
  spokes: readonly Spoke[]
  /** `spokes.length`, named for the footer's "n entries for x". */
  seen: number
  /** Entries involving the element that have not been witnessed - the empty notches. */
  stillToFind: number
  mastered: boolean
}

/** A stroke the ring draws, named for the kind whose class carries it. */
export type LegendStroke = 'react' | 'decay' | 'grow'

/** One row of the key: a sample stroke, the kinds drawn with it, what it means. */
export interface LegendRow {
  stroke: LegendStroke
  /** Every kind sharing the stroke, in graph order. */
  kinds: readonly EdgeKind[]
  /** Those kinds as words: `growth · germination · raise · bloom`. */
  label: string
  /** What the line says, in the chart's own terms - never an element (spec §7). */
  meaning: string
}

/** A rule of the chart that is not a line kind: the arrowhead, and the notches. */
export interface LegendRule {
  id: 'arrow' | 'notch'
  text: string
}

/** Every kind as a word. A new kind fails to compile until it has one. */
const KIND_WORDS: Record<EdgeKind, string> = {
  react: 'reaction',
  decay: 'decay',
  grow: 'growth',
  germinate: 'germination',
  raise: 'raise',
  bloom: 'bloom',
}

/**
 * Which stroke draws a kind (spec §6): reaction solid, decay long dash, growth
 * dotted, with the hook transmutations sharing growth's dots.
 */
const KIND_STROKE: Record<EdgeKind, LegendStroke> = {
  react: 'react',
  decay: 'decay',
  grow: 'grow',
  germinate: 'grow',
  raise: 'grow',
  bloom: 'grow',
}

/**
 * The one place the kind-to-stroke mapping lives. Both the ring's spokes and
 * the key's samples go through it and wear the stroke's own class, so a kind
 * cannot be drawn one way on the chart and sampled another way in the key -
 * which is the whole point of a key.
 */
export function strokeOf(kind: EdgeKind): LegendStroke {
  return KIND_STROKE[kind]
}

/**
 * What a stroke means. Deliberately about *shape of interaction*, not about any
 * element: nothing here can leak, because there is nothing in it to leak.
 */
const STROKE_MEANING: Record<LegendStroke, string> = {
  react: 'two elements meeting',
  decay: 'one element changing on its own, in time',
  grow: 'a living thing acting on what is next to it',
}

/** The two rules the strokes cannot state: what an arrowhead and a notch mean. */
export const LEGEND_RULES: readonly LegendRule[] = [
  {
    id: 'arrow',
    text: 'an arrowhead into the middle: that entry is what makes the one in the centre',
  },
  { id: 'notch', text: 'an empty notch: an entry for this one you have not witnessed yet' },
]

/**
 * The key's rows (ticket 11): one per stroke actually present in the derived
 * graph, carrying every kind that shares it. Which rows exist is derived rather
 * than written down, so the key teaches exactly the language the chart speaks -
 * a roster that stops drawing a kind drops it from the key, and a new kind is
 * in the key the moment it is in the graph. What a new kind still owes is its
 * word and its stroke: `KIND_WORDS` and `KIND_STROKE` are exhaustive, so it
 * cannot compile without them rather than appearing nameless.
 */
export function legendRows(index: EntryIndex = entryIndex()): readonly LegendRow[] {
  // Insertion order is graph order: reactions, decays, growth, then the hooks.
  const kindsByStroke = new Map<LegendStroke, EdgeKind[]>()
  for (const entry of index.all) {
    const kinds = kindsByStroke.get(KIND_STROKE[entry.kind]) ?? []
    if (!kinds.includes(entry.kind)) kinds.push(entry.kind)
    kindsByStroke.set(KIND_STROKE[entry.kind], kinds)
  }

  return [...kindsByStroke].map(([stroke, kinds]) => ({
    stroke,
    kinds,
    label: kinds.map((kind) => KIND_WORDS[kind]).join(PRODUCT_JOIN),
    meaning: STROKE_MEANING[stroke],
  }))
}

/**
 * The masking seam (spec §7): the one place a name becomes something that may
 * be drawn. The moment cards use it too - a card raised over the world is as
 * public as a row in the panel.
 *
 * `tags` is optional and only ever consulted for a *discovered* element, which
 * is what makes the chips spoiler-safe by construction rather than by the
 * caller remembering: the same guard that masks the name withholds them.
 */
export function refOf(name: string, view: FieldNotesView, tags?: ElementTags): ElementRef {
  const discovered = view.discovered.has(name)
  const ref: ElementRef = { name, label: discovered ? name : HIDDEN_NAME, discovered }
  if (discovered && tags) ref.tags = chipsOf(tags.get(name) ?? [])
  return ref
}

/**
 * Every element, tier order then rail order. Deterministic from the data, never
 * hand-placed: `index.elements` is the roster, whose paintables are in rail
 * order, and a stable sort by tier turns that into the columns the design
 * calls for. Tier 0 is the base rail; the products follow at their own depth.
 */
export function pickerRows(
  view: FieldNotesView,
  index: EntryIndex = entryIndex(),
): readonly PickerRow[] {
  const rows = index.elements.map((name): PickerRow => {
    const tally = view.counts.get(name) ?? { seen: 0, total: 0 }
    const ref = refOf(name, view)
    const mastered = view.mastered.has(name)
    // The unlock is the row's own goal, so it replaces the bare count rather
    // than repeating it (spec §6 "The unlock"). Once earned it is just a count
    // again - the element is in the rail, and there is nothing left to state.
    const unlockable = index.unlockable.includes(name) && !mastered
    return {
      ...ref,
      // Always computable: every discoverable element is the product of at
      // least one edge (spec §3, restored by ticket 07's hook edges), and
      // `entries.test.ts` pins that no element is left untiered.
      tier: index.tierOf(name)!,
      count: ref.discovered ? `${tally.seen}/${tally.total}${unlockable ? ' to unlock' : ''}` : '',
      mastered,
      isNew: view.newElements.has(name),
    }
  })

  // Sorting in place is safe - `rows` is this call's own array - and `sort` is
  // stable, which is what keeps roster order inside a tier.
  return rows.sort((a, b) => a.tier - b.tier)
}

/** The entry's outcome as words: its products, or "both consumed" (spec §6). */
function outcomeOf(entry: Entry, view: FieldNotesView): string {
  if (entry.products.length === 0) return CONSUMED
  return entry.products.map((name) => refOf(name, view).label).join(PRODUCT_JOIN)
}

function spokeOf(entry: Entry, focus: string, view: FieldNotesView): Spoke {
  // "This makes me": the focused element takes no part in the interaction and
  // is only its product, so the whole pair sits on the ring and the arrowhead
  // points inwards.
  const madeBy = !entry.reagents.includes(focus)
  const partner = madeBy
    ? entry.reagents[0]!
    : // A decay has one reagent, so from the decaying element's own side the
      // partner is what it turns into.
      (entry.reagents.find((name) => name !== focus) ??
      entry.products.find((name) => name !== focus) ??
      focus)

  // Charting the plant's parts as one flower (ticket 08) leaves stage entries
  // whose every name is the focus itself - the raise, the bloom. An arrowhead
  // from an element to itself says nothing, so a stage carries none; anything
  // else the focus is a reagent of points out at what it leaves, and only an
  // edge that leaves the focus and nothing else points back in.
  const stage = [...entry.reagents, ...entry.products].every((name) => name === focus)
  const direction: SpokeDirection = madeBy
    ? 'in'
    : entry.kind === 'react' || stage
      ? 'none'
      : entry.products.some((name) => name !== focus)
        ? 'out'
        : 'in'

  // A tile leading back to the centre is a dead tap, so the focused element is
  // never offered as one; the words still say what the interaction leaves.
  const tiles = (madeBy ? entry.reagents : entry.products).filter((name) => name !== focus)

  return {
    key: entry.key,
    kind: entry.kind,
    partner: refOf(partner, view),
    direction,
    outcome: madeBy
      ? entry.reagents.map((name) => refOf(name, view).label).join(REAGENT_JOIN)
      : outcomeOf(entry, view),
    tiles: tiles.map((name) => refOf(name, view)),
  }
}

/**
 * One element's ring: the entries involving it that have actually been
 * witnessed, and a count of the ones that have not. Unwitnessed entries are
 * never modelled, let alone drawn (spec §7, decision 9).
 */
export function ringFor(
  focus: string,
  view: FieldNotesView,
  tags?: ElementTags,
  index: EntryIndex = entryIndex(),
): RingModel {
  const keys = index.entriesFor(focus)
  const spokes = keys
    // Through the index: a charted entry is witnessed when any of the raw edges
    // behind it has fired (ticket 08), and the witnessed set holds raw keys.
    .filter((key) => index.isWitnessed(key, view.witnessed))
    .flatMap((key) => {
      const entry = index.get(key)
      return entry ? [spokeOf(entry, focus, view)] : []
    })

  return {
    // Only the centre gets chips: it is the one element the panel is focused
    // on, and the spokes' partners and product tiles are drawn small and
    // wordless (ticket 12).
    centre: refOf(focus, view, tags),
    spokes,
    seen: spokes.length,
    stillToFind: keys.length - spokes.length,
    mastered: view.mastered.has(focus),
  }
}
