import { useEffect, useRef } from 'react'

import { type RailPalette } from '../features/palette/paletteGroups.ts'

export interface UseSiltHotkeysOptions {
  /** `.` steps only while paused, matching the header's disabled step button. */
  running: boolean
  /** Digits 1–9 select the nth rail entry, in rail order. */
  palette: RailPalette
  /** Space. */
  onToggleRunning: () => void
  /** `.` while paused. */
  onStep: () => void
  /** A digit picked a species out of the rail. */
  onSelectElement: (id: number) => void
  /** `e`. */
  onSelectErase: () => void
  /** `[` / `]` — a step of -1 or +1 along the brush widths; the caller clamps. */
  onNudgeBrush: (delta: number) => void
  /** Ctrl/Cmd+S. */
  onSaveScene: () => void
  /** Escape. */
  onCloseScenes: () => void
}

/**
 * The app's global keydown map (spec §9). One window listener, registered
 * once: the actions it dispatches are read off a latest-value ref, so a
 * re-render never re-binds the listener.
 */
export function useSiltHotkeys(options: UseSiltHotkeysOptions): void {
  // Synced in an effect, not during render (ticket 15) — a render-phase write
  // misbehaves under concurrent rendering and StrictMode double-invocation.
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // The scene rename field is a text input: the hotkeys would eat what is
      // being typed into it — Ctrl+S included, which would save the world on
      // screen over the scene being renamed.
      if (event.target instanceof HTMLInputElement) return
      const actions = latest.current
      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        actions.onSaveScene()
        return
      }
      if (event.key === 'Escape') {
        actions.onCloseScenes()
        return
      }
      if (event.key >= '1' && event.key <= '9') {
        const entry = actions.palette.entries[Number(event.key) - 1]
        if (entry) actions.onSelectElement(entry.id)
        return
      }
      if (event.key === '[') {
        actions.onNudgeBrush(-1)
        return
      }
      if (event.key === ']') {
        actions.onNudgeBrush(1)
        return
      }
      if (event.key === ' ') {
        event.preventDefault()
        actions.onToggleRunning()
        return
      }
      if (event.key === '.') {
        if (!actions.running) actions.onStep()
        return
      }
      if (event.key === 'e' || event.key === 'E') {
        actions.onSelectErase()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
