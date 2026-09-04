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
import { entryIndex, UNLOCKABLE_NAMES, type Entry, type EntryIndex } from './entries.ts'
import type { FieldNotesView } from './fieldNotesView.ts'

/** What an undiscovered element reads as, anywhere its name would go (spec §7). */
export const HIDDEN_NAME = '- - -'

/** Separates the two reagents of the pair that makes the focused element. */
const REAGENT_JOIN = ' + '

/** Separates an entry's products. */
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
}

export interface PickerRow extends ElementRef {
  /** Minimum transmutation depth: the column, and the sort key (spec §6). */
  tier: number
  /** `seen/total`, or `n/5 to unlock` on an unearned unlockable. Empty while hidden. */
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

/**
 * The masking seam (spec §7): the one place a name becomes something that may
 * be drawn. The moment cards use it too - a card raised over the world is as
 * public as a row in the panel.
 */
export function refOf(name: string, view: FieldNotesView): ElementRef {
  const discovered = view.discovered.has(name)
  return { name, label: discovered ? name : HIDDEN_NAME, discovered }
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
    const unlockable = UNLOCKABLE_NAMES.includes(name) && !mastered
    return {
      ...ref,
      tier: index.tierOf(name) ?? 0,
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

  const direction: SpokeDirection = madeBy
    ? 'in'
    : entry.kind === 'react'
      ? 'none'
      : entry.products.includes(focus)
        ? 'in'
        : 'out'

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
  index: EntryIndex = entryIndex(),
): RingModel {
  const keys = index.entriesFor(focus)
  const spokes = keys
    .filter((key) => view.witnessed.has(key))
    .flatMap((key) => {
      const entry = index.get(key)
      return entry ? [spokeOf(entry, focus, view)] : []
    })

  return {
    centre: refOf(focus, view),
    spokes,
    seen: spokes.length,
    stillToFind: keys.length - spokes.length,
    mastered: view.mastered.has(focus),
  }
}
