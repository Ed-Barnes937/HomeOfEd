import { describe, expect, it, vi } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { swordSchema } from '../sword/swordSchema.ts'
import { drawOutline, thumbnails } from './thumbnails.ts'

const knight = normalise(swordSchema, { family: 'knight' })

const counted = () => {
  const draw = vi.fn(drawOutline)
  return { draw, tile: thumbnails(draw) }
}

describe('thumbnails', () => {
  it('draws a Kind tile from the Kind alone, so a slider leaves it be', () => {
    const { draw, tile } = counted()
    const first = tile('sword', knight, 'family', 'katana')
    const longer = tile('sword', { ...knight, bladeLength: 0.9 }, 'family', 'katana')
    const ownLonger = tile('sword', { ...knight, bladeLength: 0.9 }, 'family', 'knight')
    tile('sword', { ...knight, guard: 'winged', guardWidth: 1 }, 'family', 'knight')
    expect(longer).toBe(first)
    expect(ownLonger).toBeDefined()
    expect(draw).toHaveBeenCalledTimes(2)
  })

  it('redraws a guard tile for the guard and its Kind, not for the blade or pommel', () => {
    const { draw, tile } = counted()
    tile('guard', knight, 'guard', 'winged')
    tile('guard', { ...knight, bladeLength: 0.9, pommelSize: 1, gripLength: 0 }, 'guard', 'winged')
    expect(draw).toHaveBeenCalledTimes(1)
    tile('guard', { ...knight, guardWidth: 1 }, 'guard', 'winged')
    tile('guard', { ...knight, family: 'longsword' }, 'guard', 'winged')
    expect(draw).toHaveBeenCalledTimes(3)
  })

  it('redraws a pommel tile for the pommel, grip and Kind, not for the blade or guard', () => {
    const { draw, tile } = counted()
    tile('pommel', knight, 'pommel', 'ball')
    tile(
      'pommel',
      { ...knight, bladeLength: 0.9, guardWidth: 1, guard: 'winged' },
      'pommel',
      'ball',
    )
    expect(draw).toHaveBeenCalledTimes(1)
    tile('pommel', { ...knight, pommelSize: 1 }, 'pommel', 'ball')
    tile('pommel', { ...knight, gripLength: 0 }, 'pommel', 'ball')
    expect(draw).toHaveBeenCalledTimes(3)
  })

  it('draws the option it shows, on its own Kind', () => {
    const { draw, tile } = counted()
    tile('guard', knight, 'guard', 'curved')
    tile('sword', knight, 'family', 'katana')
    expect(draw.mock.calls[0]![0]).toMatchObject({ family: 'knight', guard: 'curved' })
    expect(draw.mock.calls[1]![0]).toMatchObject({ family: 'katana' })
  })
})
