import { useCallback, useEffect, useRef, useState } from 'react'

import { navigatorShareTarget, shareGrooveUrl } from './shareAction.ts'

/** "Copied!" holds this long, then the button goes back to resting (design §5). */
export const COPIED_HOLD_MS = 1_600

export type ShareState = 'idle' | 'pending' | 'copied'

/**
 * The one share action (ADR 0026): the system share sheet where there is one,
 * clipboard plus a "Copied!" flip otherwise. Never a modal, never a link
 * field. Shared by the desktop top bar and the phone's "⋯" menu so both tell
 * the same story.
 *
 * `getShareUrl` is called on tap, not on render, so encoding the grid never
 * rides along with playback repaints.
 */
export function useShareGroove(getShareUrl: () => string): {
  shareState: ShareState
  share: () => void
} {
  const [shareState, setShareState] = useState<ShareState>('idle')
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (revertTimer.current !== null) clearTimeout(revertTimer.current)
    },
    [],
  )

  const share = useCallback(() => {
    if (shareState === 'pending') return
    setShareState('pending')
    void shareGrooveUrl(getShareUrl(), navigatorShareTarget(navigator)).then((outcome) => {
      if (outcome !== 'copied') {
        // Shared, dismissed or refused: the OS (or nothing) is the feedback.
        setShareState('idle')
        return
      }
      setShareState('copied')
      // Tapping again mid-hold restarts the 1.6s, rather than inheriting the
      // remainder of the previous one.
      if (revertTimer.current !== null) clearTimeout(revertTimer.current)
      revertTimer.current = setTimeout(() => setShareState('idle'), COPIED_HOLD_MS)
    })
  }, [getShareUrl, shareState])

  return { shareState, share }
}
