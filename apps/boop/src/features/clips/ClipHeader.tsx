import { useState } from 'react'

import type { Clip } from '../../song/song.ts'
import { clipTint } from './clipTints.ts'
import styles from './ClipHeader.module.scss'

interface ClipHeaderProps {
  /** The clip on the grid — the one every edit writes into. */
  clip: Clip
  /** False at one clip remaining: the minimum is one (spec §2). */
  canDelete: boolean
  /** False at the 5-clip cap — a copy is a new clip, so it disables like "+ New clip". */
  canCopy: boolean
  /** Commits a rename of the active clip. Blank names are the caller's no-op. */
  onRename: (name: string) => void
  /** Duplicates the active clip's pattern into a new clip and selects it. */
  onCopy: () => void
  /** Removes the active clip and its placements. */
  onDelete: () => void
  /**
   * `Position 4 · bar 2 of 4` (boop-playhead handoff, "Readout"), or absent —
   * on a song with nothing placed there is nothing to read out, and on the
   * phone the caption sits on the WHOLE SONG strip instead.
   */
  readout: string | null
}

/**
 * The clip header row (design handoff §2): "You're changing", the clip's tint
 * dot and name, the rename pencil, then Make a copy and Delete clip. Both the
 * name and the pencil open the inline rename — the pencil exists so the
 * affordance is visible rather than discovered. Enter or blur commits;
 * Escape-free by design, and no naming is ever forced.
 */
export function ClipHeader({
  clip,
  canDelete,
  canCopy,
  onRename,
  onCopy,
  onDelete,
  readout,
}: ClipHeaderProps) {
  const [editing, setEditing] = useState<string | null>(null)

  function commit(value: string) {
    const trimmed = value.trim()
    if (trimmed !== '' && trimmed !== clip.name) onRename(trimmed)
    setEditing(null)
  }

  return (
    <div className={styles.row} data-testid="clip-header">
      <span className={styles.label}>You&rsquo;re changing</span>
      <span
        className={styles.dot}
        style={{ background: clipTint(clip.tint) }}
        data-testid="clip-tint-dot"
        aria-hidden="true"
      />
      {editing === null ? (
        <span className={styles.nameGroup}>
          <button
            type="button"
            className={styles.name}
            onClick={() => setEditing(clip.name)}
            data-testid="clip-name"
          >
            {clip.name}
          </button>
          <button
            type="button"
            className={styles.renameButton}
            onClick={() => setEditing(clip.name)}
            aria-label={`Rename ${clip.name}`}
            data-testid="clip-rename-button"
          >
            <PencilIcon />
          </button>
        </span>
      ) : (
        <input
          className={styles.nameInput}
          value={editing}
          onChange={(event) => setEditing(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(event.currentTarget.value)
          }}
          aria-label="Clip name"
          autoFocus
          data-testid="clip-rename-input"
        />
      )}
      <div className={styles.spacer} />
      {readout !== null && (
        <span className={styles.readout} data-testid="playhead-readout">
          {readout}
        </span>
      )}
      <button
        type="button"
        className={styles.copy}
        onClick={onCopy}
        disabled={!canCopy}
        data-testid="clip-copy-button"
      >
        Make a copy
      </button>
      <button
        type="button"
        className={styles.delete}
        onClick={onDelete}
        disabled={!canDelete}
        data-testid="clip-delete-button"
      >
        Delete clip
      </button>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}
