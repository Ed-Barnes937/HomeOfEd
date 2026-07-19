/**
 * Native save path (ADR 0017 §4): write the PNG to the Filesystem cache
 * directory and hand it to the OS share sheet (share → Photos/Files/AirDrop).
 * No Photos-library permission is requested (plan 0006 §1).
 *
 * The ONLY module that imports the Capacitor plugins — reached solely via a
 * dynamic import from `useDoodle`'s saveCaps(), so the plugins stay out of the
 * web bundle's runtime path (ADR 0017 consequences).
 */
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/** Chunked so String.fromCharCode stays under the argument limit on big rasters. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export async function nativeShare(blob: Blob, filename: string): Promise<void> {
  const data = toBase64(new Uint8Array(await blob.arrayBuffer()))
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
  await Share.share({ title: 'Espy', files: [uri] })
}
