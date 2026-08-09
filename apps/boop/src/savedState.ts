/**
 * "Is this boop in My boops?" (ticket 31) — the one question the chrome's
 * saved/edited indicator answers.
 *
 * boop autosaves the working grid after every lull, so "unsaved" can never
 * mean "you are about to lose this" (ADR 0025). It means the narrower thing:
 * this grid is not a row in "My boops", or it has drifted from the row it came
 * from. Starters are deliberately outside all of this — loading one reads the
 * same as a blank grid, because a starter is never in the list either.
 */

/** The saved boop the working grid came from, while it is still recognisably that boop. */
export interface LoadedBoop {
  /** Its row in "My boops" — the row that wears the loaded ring. */
  index: number
  name: string
  /** A cell toggle or a tempo change since it was loaded or saved. */
  edited: boolean
}

/** The desktop indicator's whole text. */
export function savedStateLabel(loaded: LoadedBoop | null): string {
  if (loaded === null) return 'Not saved yet'
  return loaded.edited ? `${loaded.name} • edited` : loaded.name
}

/** What the phone's dot badge fills in for — there is no room for the words. */
export function isUnsaved(loaded: LoadedBoop | null): boolean {
  return loaded === null || loaded.edited
}

/**
 * Identity is the boop's *row*, because a `StoredBoop` has no id of its own
 * (ADR 0025) — so every mutation of the "My boops" list has to say where the
 * loaded boop ended up. These are the three that can move it; they are pure so
 * the arithmetic is tested here rather than only through the dialog.
 */

/** Renaming the loaded boop does not stop it being that boop. */
export function afterRename(
  loaded: LoadedBoop | null,
  index: number,
  name: string,
): LoadedBoop | null {
  return loaded?.index === index ? { ...loaded, name } : loaded
}

/**
 * Throwing the loaded row away leaves the grid on screen with nothing in the
 * list behind it. Deleting a row above it only moves it up one.
 */
export function afterDelete(loaded: LoadedBoop | null, index: number): LoadedBoop | null {
  if (loaded === null) return loaded
  if (loaded.index === index) return null
  return index < loaded.index ? { ...loaded, index: loaded.index - 1 } : loaded
}

/** A fresh save makes the grid that new row, matching it exactly. */
export function afterSave(index: number, name: string): LoadedBoop {
  return { index, name, edited: false }
}

/**
 * One definition of "changed" for the whole app: a cell toggle *and* a tempo
 * move both count. Idempotent, so painting a whole row does not churn the
 * chrome sixteen times.
 */
export function afterEdit(loaded: LoadedBoop | null): LoadedBoop | null {
  if (loaded === null || loaded.edited) return loaded
  return { ...loaded, edited: true }
}
