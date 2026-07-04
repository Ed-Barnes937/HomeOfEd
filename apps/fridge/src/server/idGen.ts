const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * A crypto-random 10-char base62 id (ADR 0010) — the prod default for
 * `ShareBoardHandler`'s injected `idGen`. `globalThis.crypto` (WebCrypto) is
 * available natively on Node 22, no import needed. 62^10 ≈ 8×10^17 possible
 * ids, so collisions are the rare case the handler's retry loop exists for.
 */
export function randomShareId(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let id = ''
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length]
  return id
}
