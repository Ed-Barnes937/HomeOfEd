/**
 * Save-target selection over injected capabilities (ADR 0017 §4, plan 0006 §4).
 * Pure TS — no DOM, no canvas, no Capacitor imports; every capability is
 * injected so both the web and native branches unit-test with fakes.
 */

export interface SaveCaps {
  /** True when running inside the Capacitor native shell. */
  isNative: boolean
  /** Web Share API file support (includes the touch-primary heuristic). */
  canShareFiles: (file: File) => boolean
  /** Web Share sheet (navigator.share). */
  shareFiles: (file: File, title: string) => Promise<void>
  /** Anchor-click download fallback. */
  download: (blob: Blob, filename: string) => void
  /** Native share sheet via Capacitor Filesystem + Share. */
  nativeShare: (blob: Blob, filename: string) => Promise<void>
}

/**
 * Route the PNG to the best save target: native share sheet under Capacitor,
 * else the Web Share sheet when the file is shareable, else an anchor
 * download. AbortError (user dismissed a share sheet) is swallowed; any other
 * error rethrows.
 */
export async function saveImage(
  blob: Blob,
  filename: string,
  title: string,
  caps: SaveCaps,
): Promise<void> {
  try {
    if (caps.isNative) {
      await caps.nativeShare(blob, filename)
      return
    }
    const file = new File([blob], filename, { type: blob.type })
    if (caps.canShareFiles(file)) {
      await caps.shareFiles(file, title)
    } else {
      caps.download(blob, filename)
    }
  } catch (error) {
    if ((error as Error | undefined)?.name !== 'AbortError') throw error
  }
}
