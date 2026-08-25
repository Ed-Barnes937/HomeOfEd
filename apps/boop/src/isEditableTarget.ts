const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Whether an event target is a text-editing surface — the boop rename
 * field, chiefly — that the global spacebar-toggles-play listener (spec:
 * "Transport & tempo") must leave alone so a child typing a name can still
 * type a space.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  // Duck-typed rather than an `instanceof HTMLElement` check: this runs in
  // both the browser (a real DOM element) and this file's node-environment
  // unit test (a plain object shaped like one).
  if (target === null || typeof target !== 'object') return false
  const candidate = target as { tagName?: unknown; isContentEditable?: unknown }
  if (typeof candidate.tagName === 'string' && EDITABLE_TAGS.has(candidate.tagName)) return true
  return candidate.isContentEditable === true
}
