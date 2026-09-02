import { describe, expect, it } from 'vitest'

import type { Kit } from '../../engine/sequencerEngine.ts'
import { instrumentsById } from './rowInstruments.ts'

const kit: Kit = {
  kitId: 'test',
  name: 'Test kit',
  instruments: [
    { instrumentId: 'kick', name: 'Kick', artwork: 'kick.svg', sound: 'kick.wav' },
    { instrumentId: 'snare', name: 'Snare', artwork: 'snare.svg', sound: 'snare.wav' },
    { instrumentId: 'boop', name: 'Boop', artwork: 'boop.svg', sound: 'boop.wav' },
  ],
}

describe('instrumentsById', () => {
  it('resolves a row to its instrument by id, whatever position the row is in', () => {
    const byId = instrumentsById(kit)
    // The clip's rows are its own, so row 0 may be any instrument of the kit.
    expect(byId.get('boop')?.name).toBe('Boop')
    expect(byId.get('kick')?.artwork).toBe('kick.svg')
  })

  it('has nothing for an id the kit does not know, so the row can be skipped', () => {
    expect(instrumentsById(kit).get('cowbell')).toBeUndefined()
  })
})
