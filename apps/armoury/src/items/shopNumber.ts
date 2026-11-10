import type { Params } from '../engine/schema.ts'

/** FNV-1a over the params in key order, so the same item always has the same number. */
export function shopNumber(p: Params): string {
  const text = Object.keys(p)
    .sort()
    .map((k) => `${k}=${p[k]}`)
    .join('&')
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return String((hash % 9999) + 1).padStart(4, '0')
}
