/**
 * The New boop keep-card's copy (boop-clips ticket 03). One definition, like
 * `clearGridConfirm.ts`, because the action has two homes: the desktop top bar
 * and the phone's "⋯" menu.
 *
 * "New boop" is the only action besides the clip header's own delete that
 * destroys a clip (ADR 0056 §2), and a child losing what they made is the
 * feel-bad the whole app is arranged around. So the reset asks first - two
 * labelled choices a 6-year-old can read, never prose and never the browser's
 * own confirm (ADR 0031 §2 rules that out, and still does). "Save it" is the
 * safe side because nothing is lost by taking it.
 *
 * When it is raised is not this file's business: the page asks `isUnsaved`
 * (`savedState.ts`) and `songHasContent` (`song/song.ts`) together.
 */
export const NEW_BOOP_CONFIRM = {
  title: 'Keep this boop?',
  message: 'Save it to My boops, or start fresh and lose it.',
  safeLabel: 'Save it',
  destructiveLabel: 'Start fresh',
} as const
