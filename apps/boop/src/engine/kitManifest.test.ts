import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { KIT_MANIFEST_VERSION, loadKit, parseKitManifest } from './kitManifest.ts'
import { laneNoteMidi } from './pitch.ts'

/** Semitones from C: the pitch class every pitched lane's "do" has to land on. */
const F_PITCH_CLASS = 5

const validManifest = {
  version: KIT_MANIFEST_VERSION,
  kitId: 'launch',
  name: 'Launch kit',
  instruments: [
    {
      instrumentId: 'kick',
      name: 'Kick',
      artwork: '/kits/launch/artwork/drum.svg',
      sound: '/kits/launch/sounds/kick.wav',
      role: 'kick',
      group: 'drums',
    },
    {
      instrumentId: 'boop',
      name: 'Boop',
      artwork: '/kits/launch/artwork/boombox.svg',
      sound: '/kits/launch/sounds/boop.wav',
    },
  ],
}

describe('parseKitManifest', () => {
  it('reads a manifest into a kit, keeping instrument order', () => {
    const kit = parseKitManifest(validManifest)
    expect(kit.kitId).toBe('launch')
    expect(kit.instruments.map((i) => i.instrumentId)).toEqual(['kick', 'boop'])
    expect(kit.instruments[0]?.role).toBe('kick')
    expect(kit.instruments[1]?.role).toBeUndefined()
  })

  it('reads the picker group, which is optional the way the role is', () => {
    const kit = parseKitManifest(validManifest)
    expect(kit.instruments[0]?.group).toBe('drums')
    expect(kit.instruments[1]?.group).toBeUndefined()
  })

  it('reads the pitched config, and leaves an entry without one one-note', () => {
    const kit = parseKitManifest({
      ...validManifest,
      instruments: [validManifest.instruments[0], pitchedInstrument()],
    })

    expect(kit.instruments[0]?.pitched).toBeUndefined()
    expect(kit.instruments[1]?.pitched).toEqual({ rootNote: 'G3', rootMidi: 55 })
  })

  it('does not read pitched off the role: melodic is picker taxonomy (spec §3)', () => {
    const kit = parseKitManifest({
      ...validManifest,
      instruments: [{ ...dupInstrument(), role: 'melodic', group: 'notes' }],
    })

    expect(kit.instruments[0]?.pitched).toBeUndefined()
  })

  it.each([
    ['a non-object', 42],
    ['a boolean pitched', withPitched(true)],
    ['a pitched with no root note', withPitched({})],
    ['a root note that is not a string', withPitched({ rootNote: 55 })],
    ['a root note that is not a note', withPitched({ rootNote: 'H4' })],
    ['a root note with no octave', withPitched({ rootNote: 'G' })],
    ['a root note off the MIDI range', withPitched({ rootNote: 'A9' })],
    ['a missing version', { ...validManifest, version: undefined }],
    ['a future version', { ...validManifest, version: KIT_MANIFEST_VERSION + 1 }],
    ['no instruments', { ...validManifest, instruments: [] }],
    [
      'a duplicate instrumentId',
      { ...validManifest, instruments: [dupInstrument(), dupInstrument()] },
    ],
    [
      'a missing sound file',
      { ...validManifest, instruments: [{ ...dupInstrument(), sound: '' }] },
    ],
    [
      'an unknown role',
      { ...validManifest, instruments: [{ ...dupInstrument(), role: 'bagpipe' }] },
    ],
    [
      'an unknown group',
      { ...validManifest, instruments: [{ ...dupInstrument(), group: 'orchestral' }] },
    ],
  ])('rejects %s', (_case, raw) => {
    expect(() => parseKitManifest(raw)).toThrow(/kit manifest/i)
  })
})

describe('loadKit', () => {
  it('fetches and parses the manifest', async () => {
    const kit = await loadKit('/kits/launch/kit.json', () =>
      Promise.resolve(new Response(JSON.stringify(validManifest))),
    )
    expect(kit.name).toBe('Launch kit')
  })

  it('fails loudly when the manifest is not served', async () => {
    await expect(
      loadKit('/kits/nope/kit.json', () => Promise.resolve(new Response('', { status: 404 }))),
    ).rejects.toThrow(/404/)
  })
})

describe('the shipped launch kit', () => {
  const publicDir = fileURLToPath(new URL('../../public/', import.meta.url))

  async function shippedKit() {
    return parseKitManifest(JSON.parse(await readFile(`${publicDir}kits/launch/kit.json`, 'utf8')))
  }

  it('is a valid manifest of the 20-instrument roster whose files exist', async () => {
    const kit = await shippedKit()
    expect(kit.instruments).toHaveLength(20)
    for (const instrument of kit.instruments) {
      await expect(readFile(publicDir + instrument.sound.slice(1))).resolves.toBeDefined()
      await expect(readFile(publicDir + instrument.artwork.slice(1))).resolves.toBeDefined()
    }
  })

  it('puts every instrument in one of the picker groups (spec §2: 10 / 6 / 4)', async () => {
    // The picker sections the roster by this field; an instrument without one
    // would fall out of its group (it stays pickable, but unsectioned).
    const kit = await shippedKit()
    const counts = new Map<string, number>()
    for (const instrument of kit.instruments) {
      expect(instrument.group, instrument.instrumentId).toBeDefined()
      counts.set(instrument.group!, (counts.get(instrument.group!) ?? 0) + 1)
    }
    expect(Object.fromEntries(counts)).toEqual({ drums: 10, notes: 6, silly: 4 })
  })

  it('is still all one-note - the lane lands dormant (spec §11)', async () => {
    // Tickets 01-09 build the lane with no instrument flagged, so every PR of
    // this epic changes nothing a child can hear. Ticket 10 is the activation
    // and rewrites this expectation.
    const kit = await shippedKit()
    expect(kit.instruments.filter((i) => i.pitched !== undefined)).toEqual([])
  })

  it('keeps every pitched instrument in the key of F major (ADR 0059)', async () => {
    // Vacuous until ticket 10, and armed from now on: a register whose "do" is
    // not an F would put one instrument in a different key from the rest.
    // F, not the C the grill session assumed - the anchor is "so", so a root
    // sample seven semitones up is a C, and marimba's measured C5 is immovable.
    const kit = await shippedKit()
    for (const instrument of kit.instruments) {
      if (!instrument.pitched) continue
      expect(laneNoteMidi(instrument.pitched, 0) % 12, instrument.instrumentId).toBe(F_PITCH_CLASS)
    }
  })

  it('leads with the classic six, in their original order', async () => {
    // Defaults and the authored sample clips key off these positions, so the
    // six that shipped at launch must stay first in manifest order.
    const kit = await shippedKit()
    expect(kit.instruments.slice(0, 6).map((i) => i.instrumentId)).toEqual([
      'kick',
      'snare',
      'hat',
      'tom',
      'marimba',
      'boop',
    ])
  })
})

function dupInstrument() {
  return {
    instrumentId: 'kick',
    name: 'Kick',
    artwork: '/kits/launch/artwork/drum.svg',
    sound: '/kits/launch/sounds/kick.wav',
  }
}

function pitchedInstrument() {
  return { ...dupInstrument(), instrumentId: 'trumpet', pitched: { rootNote: 'G3' } }
}

function withPitched(pitched: unknown) {
  return { ...validManifest, instruments: [{ ...dupInstrument(), pitched }] }
}
