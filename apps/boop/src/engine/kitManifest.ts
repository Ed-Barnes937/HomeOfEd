import { noteNameToMidi } from './pitch.ts'
import {
  INSTRUMENT_GROUPS,
  INSTRUMENT_ROLES,
  type InstrumentGroup,
  type InstrumentRole,
  type Kit,
  type KitInstrument,
  type PitchedConfig,
} from './sequencerEngine.ts'

/**
 * Manifest schema version. Bump it when the shape changes incompatibly; the
 * parser refuses versions it does not know, so a stale app never half-reads a
 * newer kit.
 */
export const KIT_MANIFEST_VERSION = 1

/** Path the app loads its one V1 kit from. */
export const LAUNCH_KIT_URL = '/kits/launch/kit.json'

type Fetch = (input: string) => Promise<Response>

/** Fetch a kit manifest and parse it. Kits are pure data — nothing else loads instruments. */
export async function loadKit(url: string, fetchImpl: Fetch = globalThis.fetch): Promise<Kit> {
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`kit manifest ${url} could not be loaded (HTTP ${response.status})`)
  }
  return parseKitManifest(await response.json())
}

export function parseKitManifest(raw: unknown): Kit {
  const manifest = asRecord(raw, 'kit manifest')
  if (manifest.version !== KIT_MANIFEST_VERSION) {
    throw new Error(
      `kit manifest version ${String(manifest.version)} is not supported (expected ${KIT_MANIFEST_VERSION})`,
    )
  }

  const kitId = requireString(manifest.kitId, 'kit manifest kitId')
  const name = requireString(manifest.name, 'kit manifest name')
  if (!Array.isArray(manifest.instruments) || manifest.instruments.length === 0) {
    throw new Error('kit manifest must list at least one instrument')
  }

  const instruments = manifest.instruments.map(parseInstrument)
  const ids = new Set(instruments.map((instrument) => instrument.instrumentId))
  if (ids.size !== instruments.length) {
    throw new Error('kit manifest has duplicate instrumentIds')
  }

  return { kitId, name, instruments }
}

function parseInstrument(raw: unknown): KitInstrument {
  const entry = asRecord(raw, 'kit manifest instrument')
  const instrument: KitInstrument = {
    instrumentId: requireString(entry.instrumentId, 'kit manifest instrumentId'),
    name: requireString(entry.name, 'kit manifest instrument name'),
    artwork: requireString(entry.artwork, 'kit manifest instrument artwork'),
    sound: requireString(entry.sound, 'kit manifest instrument sound'),
  }
  if (entry.role !== undefined) {
    if (!isRole(entry.role)) {
      throw new Error(`kit manifest instrument role must be one of: ${INSTRUMENT_ROLES.join(', ')}`)
    }
    instrument.role = entry.role
  }
  if (entry.group !== undefined) {
    if (!isGroup(entry.group)) {
      throw new Error(
        `kit manifest instrument group must be one of: ${INSTRUMENT_GROUPS.join(', ')}`,
      )
    }
    instrument.group = entry.group
  }
  if (entry.pitched !== undefined) {
    instrument.pitched = parsePitched(entry.pitched)
  }
  return instrument
}

/**
 * The optional `pitched` config: a register, and nothing else (spec §3). An
 * entry without one is one-note, so a malformed one is corruption like any
 * other field's and fails the whole kit load rather than quietly demoting an
 * instrument to a drum.
 *
 * Only well-formedness is checked here. Whether the registers agree on a key
 * is a property of the roster *together*, not of one entry, and the engine
 * knows no key - that is asserted over the shipped kit in `kitManifest.test.ts`.
 */
function parsePitched(raw: unknown): PitchedConfig {
  const config = asRecord(raw, 'kit manifest instrument pitched')
  const rootNote = requireString(config.rootNote, 'kit manifest instrument pitched rootNote')
  const rootMidi = noteNameToMidi(rootNote)
  if (rootMidi === undefined) {
    throw new Error(
      `kit manifest instrument pitched rootNote must be a note name like "G3", not "${rootNote}"`,
    )
  }
  return { rootNote, rootMidi }
}

function isRole(value: unknown): value is InstrumentRole {
  return INSTRUMENT_ROLES.some((role) => role === value)
}

function isGroup(value: unknown): value is InstrumentGroup {
  return INSTRUMENT_GROUPS.some((group) => group === value)
}

function asRecord(raw: unknown, what: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${what} must be an object`)
  }
  return raw as Record<string, unknown>
}

function requireString(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${what} must be a non-empty string`)
  }
  return value
}
