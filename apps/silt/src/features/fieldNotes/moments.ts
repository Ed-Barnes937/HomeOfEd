/**
 * The moments (spec §6): the quiet card that rises over the world when an
 * interaction is witnessed for the first time, and the one-time line for a
 * finished chart. Pure - two views in, cards out - so the timing and the
 * rendering are the only parts that need a browser.
 *
 * Everything here is a **diff of two derived views**, never a second reading of
 * the sim's report: the store takes the witness, `fieldNotesView` re-derives,
 * and the card is what changed between the old view and the new one. That is
 * why "forget discoveries" and closing the panel raise nothing without a single
 * case for either - neither adds an edge.
 *
 * The spoiler rule reaches here too (spec §7). A card may name what the entry
 * just discovered, since the entry discovering it is what made the card; it may
 * not name anything still hidden. The one way that could happen is an entry
 * that revealed nothing and so names its reagents - `lava + mud` on a scene
 * restored from before the rail trim - so every name goes through the panel's
 * own masking, and `moments.test.ts` asserts it over the whole roster.
 */
import { entryIndex, type Entry, type EntryIndex } from './entries.ts'
import type { FieldNotesView } from './fieldNotesView.ts'
import { refOf, type ElementRef } from './panelModel.ts'

/** Separates the elements an entry revealed - the panel's own product join. */
const PRODUCT_JOIN = ' · '

/** Separates the reagents of an entry that revealed nothing new. */
const REAGENT_JOIN = ' + '

/** The small line over a discovery's name. */
const NEW_ENTRY = 'new entry'

/**
 * How many cards may be waiting at once, the one on screen included. A big
 * splash can witness a dozen firsts in a tick; showing all of them would queue
 * the world's chrome for a minute, so the backlog collapses to the newest few -
 * quiet beats complete (spec §6).
 */
export const MOMENT_QUEUE_LIMIT = 3

/** One card. Two contents (spec §6), one component - see `MomentCard.tsx`. */
export interface Moment {
  /** Stable identity: the edge key it came from, or the unlock it announces. */
  id: string
  kind: 'discovery' | 'unlock'
  /** The elements the card's words name, as tiles. Masked ones draw dark. */
  tiles: readonly ElementRef[]
  /** The small label: `new entry`, or `mud · 5 of 5`. */
  lead: string
  /** The line itself: what was discovered, or `mud joins your rail`. */
  title: string
  /** The tiles wear the panel's green "new" edge - only ever a first sighting. */
  fresh: boolean
}

/** The words for an entry that revealed nothing new: what met what. */
function interactionOf(entry: Entry, view: FieldNotesView): readonly ElementRef[] {
  return entry.reagents.map((name) => refOf(name, view))
}

function discoveryOf(entry: Entry, before: FieldNotesView, after: FieldNotesView): Moment {
  // Exactly the products the player had not seen before *and* has now, which is
  // what makes naming them safe. Both halves are load-bearing since ticket 08: a
  // charted entry lists what its raw edges can leave between them, and burning a
  // stalk does not reveal the steam a sprout would have made.
  const found = entry.products.filter(
    (name) => !before.discovered.has(name) && after.discovered.has(name),
  )
  const fresh = found.length > 0
  const tiles = fresh ? found.map((name) => refOf(name, after)) : interactionOf(entry, after)

  return {
    id: entry.key,
    kind: 'discovery',
    tiles,
    lead: NEW_ENTRY,
    title: tiles.map((tile) => tile.label).join(fresh ? PRODUCT_JOIN : REAGENT_JOIN),
    fresh,
  }
}

function unlockOf(name: string, after: FieldNotesView): Moment {
  const tally = after.counts.get(name) ?? { seen: 0, total: 0 }
  const element = refOf(name, after)
  return {
    id: `unlock:${name}`,
    kind: 'unlock',
    tiles: [element],
    // The mockup sets a mastery star after the count here; the star is the
    // panel's marker for a state, and a card that already says "5 of 5" and
    // "joins your rail" is not short of the news. Spec §6's own wording has
    // none either.
    lead: `${element.label}${PRODUCT_JOIN}${tally.seen} of ${tally.total}`,
    title: `${element.label} joins your rail`,
    // Mastering an element means witnessing every entry that names it, so it
    // was discovered long before this card - there is nothing new about it.
    fresh: false,
  }
}

/**
 * The cards for what moved between two views: one per entry witnessed for the
 * first time, then one per element that mastering has just earned into the rail.
 * The unlock comes last so that a collapsing burst keeps it (`queueMoments`).
 */
export function momentsFor(
  before: FieldNotesView,
  after: FieldNotesView,
  index: EntryIndex = entryIndex(),
): readonly Moment[] {
  const moments: Moment[] = []
  const raised = new Set<string>()

  for (const key of after.witnessed) {
    if (before.witnessed.has(key)) continue
    // A key this roster cannot resolve (a hand-edited blob, a renamed element)
    // counts for nothing anywhere else either - spec §5's forward compatibility.
    const entry = index.get(key)
    if (!entry) continue
    // The card is for a new *entry*, not a new key: since ticket 08 several raw
    // edges can share one charted entry, and the second flower part to burn is
    // not news. `raised` catches the ones that arrive in the same batch.
    if (raised.has(entry.key) || index.isWitnessed(entry.key, before.witnessed)) continue
    raised.add(entry.key)
    moments.push(discoveryOf(entry, before, after))
  }
  // Nothing was witnessed, so nothing can have been mastered either: a reset or
  // a `markReviewed` gets no cards, without either needing a case of its own.
  if (moments.length === 0) return moments

  for (const name of after.unlocked) {
    if (!before.unlocked.includes(name)) moments.push(unlockOf(name, after))
  }

  return moments
}

/**
 * Adds arriving cards to the queue. The head is on screen and mid-animation, so
 * it is never the one dropped; everything behind it collapses to the newest
 * `MOMENT_QUEUE_LIMIT - 1` (spec §6).
 */
export function queueMoments(
  queue: readonly Moment[],
  arriving: readonly Moment[],
): readonly Moment[] {
  const next = [...queue, ...arriving]
  if (next.length <= MOMENT_QUEUE_LIMIT) return next

  const [showing, ...backlog] = next
  return [showing!, ...backlog.slice(backlog.length - (MOMENT_QUEUE_LIMIT - 1))]
}

/**
 * The 100% line's whole state (spec §6): one line over the world when the last
 * entry lands, once, and never on a later load. Not a `Moment` - it is neither
 * a card nor queued with them; it is the one thing the world says for itself.
 * `spent` is what makes it "once"
 * - a chart that was already complete when the page opened had its moment in
 * the session that finished it, and forgetting discoveries does not buy another.
 */
export interface CompletionState {
  /** Whether the chart was complete the last time progress moved. */
  wasComplete: boolean
  /** Whether the line has had its one showing. */
  spent: boolean
  /** Whether it is on screen now. */
  showing: boolean
}

/** The state a page starts in, given the chart it loaded. */
export function completionAtBoot(complete: boolean): CompletionState {
  return { wasComplete: complete, spent: complete, showing: false }
}

/** Folds the current completeness in: the line fires only on the transition. */
export function advanceCompletion(state: CompletionState, complete: boolean): CompletionState {
  if (complete === state.wasComplete) return state
  if (!complete) return { ...state, wasComplete: false }
  return { wasComplete: true, spent: true, showing: !state.spent }
}

/** The line's time is up. */
export function dismissCompletion(state: CompletionState): CompletionState {
  return state.showing ? { ...state, showing: false } : state
}

/** Whether every interaction this roster knows has been witnessed. */
export function isComplete(view: FieldNotesView): boolean {
  const { seen, total } = view.totals.interactions
  return total > 0 && seen === total
}
