/**
 * Stored progress read as the panel reads it: the witnessed edges turned into
 * every count and set the header control, the picker, the ring, the rail
 * unlock and the moment cards show (spec §5, §6). Pure - same progress, same
 * view, no storage and no DOM - which is where this feature's tests live.
 *
 * Nothing here is stored (spec §5): mastery, unlocks, denominators and the
 * `NEW` set are all recomputed from `edges` plus the roster, so a new element
 * or reaction row moves every number without a migration.
 */
import type { EdgeKey } from './edgeKeys.ts'
import { entryIndex, UNLOCKABLE_NAMES, type EntryIndex } from './entries.ts'
import type { Progress } from './fieldNotesStore.ts'

/** `seen of total` - what the counters, the picker rows and the chip all show. */
export interface Tally {
  seen: number
  total: number
}

/** Everything derived from the witnessed set. None of it is ever stored (spec §5). */
export interface FieldNotesView {
  /** The witnessed edge keys, ones this roster cannot resolve included. */
  witnessed: ReadonlySet<EdgeKey>
  /** Pre-knowns plus every element a witnessed entry produced. */
  discovered: ReadonlySet<string>
  /** Elements whose every entry has been witnessed. */
  mastered: ReadonlySet<string>
  /** Mastered unlockables: the elements that join the paint rail. */
  unlocked: readonly string[]
  /**
   * Whether the roster still holds an unlockable nobody has mastered - the
   * rail's "more to earn" teaser. A boolean, and derived here rather than in
   * the page, so the rail says only *that* there is more, never what (spec §7),
   * and so unlock state has one source like everything else.
   */
  moreToEarn: boolean
  /** Elements discovered since the panel last showed them - the `NEW n` chip. */
  newElements: ReadonlySet<string>
  /** Per element, how many of the entries involving it have been witnessed. */
  counts: ReadonlyMap<string, Tally>
  /** The panel header's two denominators, both read off the live roster. */
  totals: { elements: Tally; interactions: Tally }
}

/** How many of `keys` have been witnessed. */
function seenAmong(keys: readonly EdgeKey[], witnessed: ReadonlySet<EdgeKey>): number {
  return keys.reduce((count, key) => (witnessed.has(key) ? count + 1 : count), 0)
}

/**
 * `newElements` is the one derivation that looks backwards. `edges` is a
 * timeline and `reviewed` is a point on it, so what the player has yet to be
 * shown is simply what the prefix did not already imply - which is how the chip
 * survives a reload without a single element name being stored.
 */
export function fieldNotesView(
  progress: Progress,
  index: EntryIndex = entryIndex(),
): FieldNotesView {
  const witnessed = new Set(progress.edges)
  const { discovered, mastered, unlocked } = index.derive(witnessed)
  const reviewed = index.derive(new Set(progress.edges.slice(0, progress.reviewed))).discovered

  return {
    witnessed,
    discovered,
    mastered,
    unlocked,
    moreToEarn: unlocked.length < UNLOCKABLE_NAMES.length,
    newElements: new Set([...discovered].filter((name) => !reviewed.has(name))),
    counts: new Map(
      index.elements.map((name) => {
        const keys = index.entriesFor(name)
        return [name, { seen: seenAmong(keys, witnessed), total: keys.length }]
      }),
    ),
    totals: {
      elements: { seen: discovered.size, total: index.elements.length },
      // Only keys this roster knows count towards the denominator it shows.
      interactions: { seen: seenAmong(index.keys, witnessed), total: index.keys.length },
    },
  }
}
