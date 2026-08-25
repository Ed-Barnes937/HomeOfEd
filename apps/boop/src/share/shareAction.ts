/**
 * The one Share action: the OS share sheet on touch devices (the spec's
 * "mobile"), clipboard everywhere else. Capability alone can't decide —
 * macOS Safari and Windows Chrome/Edge ship `navigator.share` too, and the
 * spec wants those desktops copying with a "Copied!" flip, not the OS sheet.
 * No modal and no "copy this link" field — the button itself is the whole
 * affordance (design handoff §5).
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

export async function shareBoopUrl(url: string, target: ShareTarget): Promise<ShareOutcome> {
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

/**
 * The browser's `navigator`, narrowed to what sharing needs. `preferSheet`
 * (touch device or not) is the caller's call — see the header for why the
 * sheet can't be offered on capability alone.
 */
export function navigatorShareTarget(nav: Navigator, preferSheet: boolean): ShareTarget {
  return {
    share:
      preferSheet && typeof nav.share === 'function' ? (data) => nav.share(data) : undefined,
    clipboard: nav.clipboard,
  }
}

/**
 * Touch device — the spec's "mobile", where the OS sheet beats the clipboard
 * (share) and the download (export). Read at tap time, not module load, so a
 * responsive-mode toggle mid-session is honoured.
 */
export function prefersShareSheet(): boolean {
  return globalThis.matchMedia?.('(pointer: coarse)').matches ?? false
}

/** A cancelled OS share sheet, on both `shareAction` and `exportAction`'s share paths. */
export function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  )
}
