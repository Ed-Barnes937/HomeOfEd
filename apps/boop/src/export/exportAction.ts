import { isAbort } from '../share/shareAction.ts'

/**
 * The demoted "get the audio" action: the OS share sheet on a touch device
 * that can share files, an object-URL download everywhere else. Capability
 * alone can't decide — desktop Safari/Chrome can share files too, and the
 * spec wants desktop downloading (see `shareAction.ts`). Follows
 * `shareAction.ts`'s injected-target idiom so both paths are unit-testable
 * against plain fakes rather than a real `navigator`.
 */

export interface ExportTarget {
  /** `navigator.canShare?.({ files })` feature-detection for a given file. */
  canShareFiles?: (file: File) => boolean
  share?: (data: { files: File[]; title?: string }) => Promise<void>
  /** The desktop path, and the fallback when sharing isn't available or is refused. */
  download: (blob: Blob, filename: string) => void
}

/**
 * - `shared` — the share sheet took the file.
 * - `downloaded` — saved via the desktop download path.
 * - `dismissed` — the child backed out of the share sheet; the file was not
 *   also downloaded behind their back.
 */
export type ExportOutcome = 'shared' | 'downloaded' | 'dismissed'

export async function exportGrooveWav(
  blob: Blob,
  filename: string,
  target: ExportTarget,
): Promise<ExportOutcome> {
  if (target.share) {
    const file = new File([blob], filename, { type: blob.type || 'audio/wav' })
    if (target.canShareFiles?.(file)) {
      try {
        await target.share({ files: [file], title: 'boop' })
        return 'shared'
      } catch (error) {
        if (isAbort(error)) return 'dismissed'
        // Refused for another reason: fall through to the download path.
      }
    }
  }

  target.download(blob, filename)
  return 'downloaded'
}

/**
 * The browser's `navigator`/`document`, narrowed to what export needs.
 * `preferSheet` (touch device or not) is the caller's call — see the header.
 */
export function navigatorExportTarget(
  nav: Navigator,
  doc: Document,
  preferSheet: boolean,
): ExportTarget {
  return {
    canShareFiles:
      preferSheet && typeof nav.canShare === 'function'
        ? (file) => nav.canShare({ files: [file] })
        : undefined,
    share:
      preferSheet && typeof nav.share === 'function' ? (data) => nav.share(data) : undefined,
    download: (blob, filename) => downloadBlob(blob, filename, doc),
  }
}

function downloadBlob(blob: Blob, filename: string, doc: Document): void {
  const url = URL.createObjectURL(blob)
  const anchor = doc.createElement('a')
  anchor.href = url
  anchor.download = filename
  doc.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
