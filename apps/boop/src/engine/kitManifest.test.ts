import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { KIT_MANIFEST_VERSION, loadKit, parseKitManifest } from './kitManifest.ts'

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

  it.each([
    ['a non-object', 42],
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
