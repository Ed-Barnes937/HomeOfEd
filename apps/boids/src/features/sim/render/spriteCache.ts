/**
 * Per-palette-colour cache of expensive render assets (glow sprites, trail
 * gradients). Entries are rebuilt only when `key` changes — the key encodes
 * everything the asset depends on (theme, shape, dpr, streak length, …).
 */
export class KeyedColourCache<T> {
  private key: string | null = null
  private entries: T[] = []

  get(key: string, colours: readonly string[], build: (colour: string) => T): T[] {
    if (this.key !== key) {
      this.entries = colours.map(build)
      this.key = key
    }
    return this.entries
  }
}
