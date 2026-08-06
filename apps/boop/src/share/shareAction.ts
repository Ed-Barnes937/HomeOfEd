/**
 * The one Share action: the OS share sheet where there is one (mobile),
 * clipboard everywhere else. No modal and no "copy this link" field — the
 * button itself is the whole affordance (design handoff §5).
 *
 * Takes the capabilities it needs rather than reaching for `navigator`, so the
 * mobile and desktop paths are both unit-testable against plain fakes.
 */

export interface ShareTarget {
  share?: (data: { title?: string; text?: string; url: string }) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

/**
 * - `shared` — the share sheet took it (no label flip; the OS gave feedback).
 * - `copied` — it is on the clipboard; the button flips to "Copied!".
 * - `dismissed` — the child backed out of the share sheet; say nothing.
 * - `unavailable` — the browser refused both; say nothing rather than error.
 */
export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'unavailable'

export async function shareGrooveUrl(url: string, target: ShareTarget): Promise<ShareOutcome> {
  if (target.share) {
    try {
      await target.share({ title: 'boop', text: 'I made this on boop', url })
      return 'shared'
    } catch (error) {
      // A cancelled sheet is a choice, not a failure — don't quietly copy.
      if (isAbort(error)) return 'dismissed'
    }
  }

  if (target.clipboard) {
    try {
      await target.clipboard.writeText(url)
      return 'copied'
    } catch {
      return 'unavailable'
    }
  }

  return 'unavailable'
}

/** The browser's `navigator`, narrowed to what sharing needs. */
export function navigatorShareTarget(nav: Navigator): ShareTarget {
  return {
    share: typeof nav.share === 'function' ? (data) => nav.share(data) : undefined,
    clipboard: nav.clipboard,
  }
}

/** A cancelled OS share sheet, on both `shareAction` and `exportAction`'s share paths. */
export function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  )
}
