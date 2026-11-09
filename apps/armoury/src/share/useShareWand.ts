import { useCallback, useEffect, useRef, useState } from 'react'

import { navigatorShareTarget, prefersShareSheet, shareWandUrl } from './shareAction.ts'

export const COPIED_HOLD_MS = 1_600

export type ShareState = 'idle' | 'pending' | 'copied'

export function useShareWand(getShareUrl: () => string): {
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
    const target = navigatorShareTarget(navigator, prefersShareSheet())
    void shareWandUrl(getShareUrl(), target).then((outcome) => {
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
