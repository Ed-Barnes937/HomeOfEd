/**
 * The clear-grid confirm's copy, verbatim from the design handoff ("Save,
 * rename, delete, clear, share" — "Both confirms"). One definition because the
 * action has two homes: the desktop transport bar and the phone's "⋯" menu.
 */
export const CLEAR_GRID_CONFIRM = {
  title: 'Clear the whole grid?',
  message: 'Every step comes off. Saved grooves stay.',
  safeLabel: 'Keep playing',
  destructiveLabel: 'Clear it',
} as const
