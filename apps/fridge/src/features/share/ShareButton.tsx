import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import type { StoredBoard } from '../board/serialize.ts'
import { trpcClient } from '../../trpcClient.ts'
import styles from './ShareButton.module.scss'

/**
 * Publishes the current board as an immutable snapshot (ADR 0010) and shows
 * the resulting `/b/<id>` link (copied to the clipboard when allowed). Enabled
 * only when there's something to share (`disabled` when the board is empty).
 * The origin is taken from `window.location`, so the link is
 * `fridge.homeofed.com/b/<id>` in prod and origin-relative everywhere else.
 */
export function ShareButton({ board, disabled }: { board: StoredBoard; disabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const share = useMutation({
    mutationFn: (b: StoredBoard) => trpcClient.board.share.mutate(b),
    onSuccess: ({ id }) => {
      const shareUrl = `${window.location.origin}/b/${id}`
      setUrl(shareUrl)
      setCopied(false)
      void copyToClipboard(shareUrl).then(setCopied)
    },
  })

  async function copyAgain(): Promise<void> {
    if (url) setCopied(await copyToClipboard(url))
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.share}
        data-testid="share-button"
        disabled={disabled || share.isPending}
        onClick={() => share.mutate(board)}
      >
        Share
      </button>
      {url && (
        <div className={styles.popover} data-testid="share-result">
          <span className={styles.caption}>Anyone with this link can open their own copy</span>
          <div className={styles.row}>
            <input className={styles.url} data-testid="share-url" value={url} readOnly />
            <button type="button" className={styles.copy} onClick={() => void copyAgain()}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Best-effort clipboard write; returns whether it succeeded (denied in some envs). */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
