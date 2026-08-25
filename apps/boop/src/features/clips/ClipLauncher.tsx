import type { Clip } from '../../song/song.ts'
import { clipTint } from './clipTints.ts'
import styles from './ClipLauncher.module.scss'

interface ClipLauncherProps {
  /** The clip on the grid — the one the card opens on. */
  clip: Clip
  /** Whether the *clip* loop is running. Song playback reads as stopped here. */
  isPlaying: boolean
  /** Play/stop looping the clip on the grid — the same action as `ClipControl`'s. */
  onToggle: () => void
  /** Opens the clip editor card. */
  onOpen: () => void
}

/**
 * The dock's one launcher row (screenspace ticket 03). The song bar is the
 * home surface now, so the grid is behind a tap and this row is the standing,
 * labelled way back to it: clip play, the clip's tint dot and name, and
 * "Edit".
 *
 * It carries *clip* play only. Song play is in the song bar's header, and the
 * song bar is on the frame at every width, so putting song play here as well
 * would be the second identical button the ticket exists to remove.
 *
 * Nothing else is in the dock. The old `Transport` stacked under this row on
 * the phone and led with the same clip play button; Speed left it for the song
 * bar's header (screenspace ticket 02) and New boop for the "⋯" menu, so the
 * bar had nothing of its own left.
 */
export function ClipLauncher({ clip, isPlaying, onToggle, onOpen }: ClipLauncherProps) {
  return (
    <div className={styles.launcher} data-testid="clip-launcher">
      <button
        type="button"
        className={styles.play}
        onClick={onToggle}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Stop this clip' : 'Play this clip'}
        data-playing={isPlaying}
        data-testid="clip-launcher-play"
      >
        {isPlaying ? (
          <span className={styles.pause} aria-hidden="true">
            <span className={styles.pauseBar} />
            <span className={styles.pauseBar} />
          </span>
        ) : (
          <span className={styles.triangle} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className={styles.open}
        onClick={onOpen}
        aria-label={`Edit ${clip.name}`}
        data-testid="clip-launcher-open"
      >
        <span
          className={styles.dot}
          style={{ background: clipTint(clip.tint) }}
          data-testid="clip-launcher-dot"
          aria-hidden="true"
        />
        <span className={styles.name} data-testid="clip-launcher-name">
          {clip.name}
        </span>
        <span className={styles.action} aria-hidden="true">
          Edit
        </span>
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  )
}
