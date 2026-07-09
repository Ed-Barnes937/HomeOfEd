import strip from './Strip.module.scss'

export interface StripCycleProps {
  /** Uppercase key, e.g. "Ring". */
  label: string
  /** The current value shown after the label, e.g. "96" or "on". */
  value: string
  /** Advance to the next value (Ring) or flip the boolean (Rake / Preview). */
  onCycle: () => void
  testId: string
  ariaLabel: string
  /**
   * When provided, the control is a two-state switch and reports `aria-checked`;
   * omit for a multi-value cycle (Ring), which announces via `ariaLabel` instead.
   */
  checked?: boolean
}

/**
 * A single strip item that changes on click — the minimal-console replacement
 * for the segmented ring picker and the toggle switches (ADR 0021). Ring cycles
 * 96 → 120 → 144; Rake / Preview flip on ↔ off (rendered as a `switch`).
 */
export function StripCycle({ label, value, onCycle, testId, ariaLabel, checked }: StripCycleProps) {
  return (
    <button
      type="button"
      className={strip.item}
      data-testid={testId}
      role={checked === undefined ? undefined : 'switch'}
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onCycle}
    >
      <span className={strip.k}>{label}</span>
      <span className={strip.v}>{value}</span>
    </button>
  )
}
