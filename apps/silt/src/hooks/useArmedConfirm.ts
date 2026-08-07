import { useEffect, useRef, useState } from 'react'

/** How long an arm-then-confirm control stays armed (spec §3, §9). */
export const ARM_MS = 3000

export interface ArmedConfirm<T> {
  /** The armed value, or `null` when disarmed. */
  armed: T | null
  /** Arms with `value`, auto-disarming after `ms`. */
  arm: (value: T) => void
  /** Disarms immediately. */
  disarm: () => void
}

/**
 * One arm-then-confirm state machine (spec §3 reset confirm, §9 scene delete):
 * arm sets a value that auto-clears after `ms`; disarm clears it early.
 */
export function useArmedConfirm<T = true>(ms: number = ARM_MS): ArmedConfirm<T> {
  const [armed, setArmed] = useState<T | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const disarm = (): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setArmed(null)
  }

  const arm = (value: T): void => {
    if (timer.current) clearTimeout(timer.current)
    setArmed(value)
    timer.current = setTimeout(() => {
      timer.current = null
      setArmed(null)
    }, ms)
  }

  return { armed, arm, disarm }
}
