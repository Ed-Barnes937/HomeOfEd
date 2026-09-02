import type { Kit, KitInstrument } from '../../engine/sequencerEngine.ts'

/**
 * The kit indexed by `instrumentId`.
 *
 * A clip owns its rows (ADR 0041), so a row's position no longer indexes the
 * kit: both renderers look an instrument's name and artwork up by the row's
 * own id. Row *colour* stays positional (`ROW_COLOR_VARS`) — that is a
 * deliberate difference, not an oversight.
 */
export function instrumentsById(kit: Kit): Map<string, KitInstrument> {
  return new Map(kit.instruments.map((instrument) => [instrument.instrumentId, instrument]))
}
