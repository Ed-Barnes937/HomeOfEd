import { isAbort } from './shareAction.ts'

// The share card: the OS share sheet on a touch device that can share files, a
// download everywhere else (ADR 0075, after boop's export action).

export interface PictureTarget {
  canShareFiles?: (file: File) => boolean
  share?: (data: { files: File[]; title?: string }) => Promise<void>
  download: (blob: Blob, filename: string) => void
}

export type PictureOutcome = 'shared' | 'downloaded' | 'dismissed'

export async function savePicture(
  blob: Blob,
  filename: string,
  target: PictureTarget,
): Promise<PictureOutcome> {
  if (target.share) {
    const file = new File([blob], filename, { type: blob.type || 'image/png' })
    if (target.canShareFiles?.(file)) {
      try {
        await target.share({ files: [file], title: 'Armoury' })
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

export function navigatorPictureTarget(
  nav: Navigator,
  doc: Document,
  preferSheet: boolean,
): PictureTarget {
  return {
    canShareFiles:
      preferSheet && typeof nav.canShare === 'function'
        ? (file) => nav.canShare({ files: [file] })
        : undefined,
    share: preferSheet && typeof nav.share === 'function' ? (data) => nav.share(data) : undefined,
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

export function wandFilename(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug === '' ? 'wand' : slug}.png`
}
