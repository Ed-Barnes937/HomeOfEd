/** In-memory stand-in for `localStorage` — fakes over mocks (root CLAUDE §5). */
export class FakeStorage {
  readonly store = new Map<string, string>()
  /** Set to make every read and write throw, as a locked-down browser does. */
  unavailable = false

  getItem(key: string): string | null {
    if (this.unavailable) throw new Error('storage unavailable')
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.unavailable) throw new Error('storage unavailable')
    this.store.set(key, value)
  }
}
