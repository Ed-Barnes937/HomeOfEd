import { describe, expect, it } from 'vitest'

import type { Magnet } from './model.ts'
import {
  type BoardState,
  boardReducer,
  buildAddAction,
  initialBoardState,
  type SpawnOpts,
} from './useFridgeBoard.ts'

/** Deterministic PRNG so spawn placement is reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 600
const H = 400

/** An empty board with a measured surface — the usual test starting point. */
function emptyBoard(): BoardState {
  return boardReducer(initialBoardState([]), { type: 'setSurface', w: W, h: H })
}

function add(state: BoardState, opts: SpawnOpts, rng: () => number = () => 0.5): BoardState {
  return boardReducer(state, buildAddAction(state, opts, rng))
}

describe('add', () => {
  it('spawns via the injected rng, relaxes into bounds, and selects the new magnet', () => {
    const s = add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 }, mulberry32(42))
    expect(s.magnets).toHaveLength(1)
    const m = s.magnets[0]!
    expect(m).toMatchObject({ id: 1, type: 'letter', label: 'A', w: 52, h: 60 })
    expect(s.selId).toBe(1)
    expect(s.nextId).toBe(2)
    // relax clamps every box into the surface.
    expect(m.x).toBeGreaterThanOrEqual(0)
    expect(m.y).toBeGreaterThanOrEqual(0)
    expect(m.x).toBeLessThanOrEqual(W - m.w)
    expect(m.y).toBeLessThanOrEqual(H - m.h)
  })

  it('derives w/h from the type (fraction discs are 64×64, numbers 50×60)', () => {
    const frac = add(emptyBoard(), { type: 'fraction', label: '', deg: 120 })
    expect(frac.magnets[0]).toMatchObject({ w: 64, h: 64, deg: 120 })
    const num = add(emptyBoard(), { type: 'number', label: '7', deg: 0 })
    expect(num.magnets[0]).toMatchObject({ w: 50, h: 60, label: '7' })
  })

  it('cycles palette colours in order when pick is auto (null)', () => {
    let s = emptyBoard()
    const colors: string[] = []
    for (let i = 0; i < 4; i++) {
      s = add(s, { type: 'letter', label: 'X', deg: 0 })
      colors.push(s.magnets.at(-1)!.color)
    }
    expect(colors).toEqual(['red', 'blue', 'green', 'yellow'])
  })

  it('uses the picked swatch colour and leaves the auto cursor untouched', () => {
    let s = boardReducer(emptyBoard(), { type: 'setPick', pick: 2 }) // green
    s = add(s, { type: 'letter', label: 'X', deg: 0 })
    expect(s.magnets[0]!.color).toBe('green')
    expect(s.colorCursor).toBe(-1)
  })
})

describe('remove / clear', () => {
  it('removes a magnet and clears its selection', () => {
    let s = add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 })
    const id = s.magnets[0]!.id
    s = boardReducer(s, { type: 'remove', id })
    expect(s.magnets).toHaveLength(0)
    expect(s.selId).toBeNull()
  })

  it('clear empties the board and deselects, but keeps the name', () => {
    let s = { ...add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 }), name: 'Fridge 1' }
    s = add(s, { type: 'letter', label: 'B', deg: 0 })
    s = boardReducer(s, { type: 'clear' })
    expect(s.magnets).toHaveLength(0)
    expect(s.selId).toBeNull()
    expect(s.dragId).toBeNull()
    expect(s.name).toBe('Fridge 1')
  })

  it('newBoard empties the board, deselects, and resets the name', () => {
    let s = { ...add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 }), name: 'Fridge 1' }
    s = boardReducer(s, { type: 'newBoard' })
    expect(s.magnets).toHaveLength(0)
    expect(s.selId).toBeNull()
    expect(s.dragId).toBeNull()
    expect(s.name).toBe('')
  })
})

describe('sweep', () => {
  it('startSweep on an empty board is a no-op (no sweep begins)', () => {
    const s = boardReducer(emptyBoard(), { type: 'startSweep' })
    expect(s.sweeping).toBe(false)
    expect(s.magnets).toHaveLength(0)
  })

  it('startSweep with magnets begins the sweep and deselects, keeping magnets on the board', () => {
    let s = add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 })
    s = add(s, { type: 'letter', label: 'B', deg: 0 })
    s = boardReducer(s, { type: 'startSweep' })
    expect(s.sweeping).toBe(true)
    expect(s.selId).toBeNull()
    // Magnets stay in state during the animation; clear() empties them later.
    expect(s.magnets).toHaveLength(2)
  })

  it('startSweep while already sweeping is a no-op (guards double-trigger)', () => {
    let s = add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 })
    s = boardReducer(s, { type: 'startSweep' })
    const again = boardReducer(s, { type: 'startSweep' })
    expect(again).toBe(s)
  })

  it('clear ends any in-flight sweep (resets the flag)', () => {
    let s = add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 })
    s = boardReducer(s, { type: 'startSweep' })
    s = boardReducer(s, { type: 'clear' })
    expect(s.sweeping).toBe(false)
    expect(s.magnets).toHaveLength(0)
  })

  it('the board is read-only while sweeping: add is a no-op', () => {
    let s = add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 })
    s = boardReducer(s, { type: 'startSweep' })
    const after = add(s, { type: 'letter', label: 'B', deg: 0 })
    expect(after.magnets).toHaveLength(1) // B never lands; the sweep is emptying
  })

  it('the board is read-only while sweeping: loadBoard is a no-op', () => {
    let s = add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 })
    s = boardReducer(s, { type: 'startSweep' })
    const other: Magnet[] = [
      { id: 5, type: 'number', label: '5', color: 'blue', deg: 0, x: 3, y: 3, w: 50, h: 60, rot: 0, z: 5 },
    ]
    const after = boardReducer(s, { type: 'loadBoard', magnets: other, finish: 'red', wall: 'dark', name: 'Other' })
    expect(after).toBe(s) // load ignored until the sweep finishes
  })
})

describe('name / loadBoard', () => {
  it('setName updates the active board name', () => {
    const s = boardReducer(emptyBoard(), { type: 'setName', name: 'My Fridge' })
    expect(s.name).toBe('My Fridge')
  })

  it('loadBoard replaces magnets/finish/wall/name and recomputes id/z from array order', () => {
    const magnets: Magnet[] = [
      { id: 9, type: 'letter', label: 'X', color: 'red', deg: 0, x: 1, y: 1, w: 52, h: 60, rot: 0, z: 9 },
      { id: 3, type: 'number', label: '1', color: 'blue', deg: 0, x: 2, y: 2, w: 50, h: 60, rot: 0, z: 3 },
    ]
    const s = boardReducer(
      { ...add(emptyBoard(), { type: 'letter', label: 'A', deg: 0 }), selId: 1, dragId: 1 },
      { type: 'loadBoard', magnets, finish: 'red', wall: 'dark', name: 'Loaded' },
    )
    expect(s.magnets).toEqual(magnets)
    expect(s.finish).toBe('red')
    expect(s.wall).toBe('dark')
    expect(s.name).toBe('Loaded')
    expect(s.selId).toBeNull()
    expect(s.dragId).toBeNull()
    // nextId/zTop derive from the loaded magnets' own id/z, not the prior board's.
    expect(s.nextId).toBe(10)
    expect(s.zTop).toBe(9)
  })
})

describe('rotation', () => {
  const withMagnet = (rot: number): BoardState => {
    const base = initialBoardState([
      { id: 1, type: 'letter', label: 'A', color: 'red', deg: 0, x: 100, y: 100, w: 52, h: 60, rot, z: 1 },
    ])
    return { ...base, surfW: W, surfH: H }
  }

  it('wheelRot adds/subtracts a step by scroll direction and selects the magnet', () => {
    let s = withMagnet(10)
    s = boardReducer(s, { type: 'wheelRot', id: 1, deltaY: 5 })
    expect(s.magnets[0]!.rot).toBe(17)
    expect(s.selId).toBe(1)
    s = boardReducer(s, { type: 'wheelRot', id: 1, deltaY: -5 })
    expect(s.magnets[0]!.rot).toBe(10)
  })

  it('setRot sets the live angle; snapRot snaps within 7° and normalises', () => {
    let s = boardReducer(withMagnet(0), { type: 'setRot', id: 1, rot: 6 })
    expect(s.magnets[0]!.rot).toBe(6)
    s = boardReducer(s, { type: 'snapRot', id: 1 })
    expect(s.magnets[0]!.rot).toBe(0) // 6° is within the 7° snap window

    let t = boardReducer(withMagnet(0), { type: 'setRot', id: 1, rot: 40 })
    t = boardReducer(t, { type: 'snapRot', id: 1 })
    expect(t.magnets[0]!.rot).toBe(40) // 40° is outside the window → unsnapped
  })
})

describe('drag + bump', () => {
  it('moving the dragged magnet onto a neighbour displaces the neighbour', () => {
    const magnets: Magnet[] = [
      { id: 1, type: 'letter', label: 'A', color: 'red', deg: 0, x: 100, y: 100, w: 52, h: 60, rot: 0, z: 1 },
      { id: 2, type: 'letter', label: 'B', color: 'blue', deg: 0, x: 300, y: 100, w: 52, h: 60, rot: 0, z: 2 },
    ]
    const s0 = { ...initialBoardState(magnets), surfW: W, surfH: H }
    // Drag A right on top of B's position → B must be shoved aside.
    const s1 = boardReducer(s0, { type: 'moveDrag', id: 1, x: 300, y: 100 })
    const a = s1.magnets.find((m) => m.id === 1)!
    const b = s1.magnets.find((m) => m.id === 2)!
    expect(b.x).not.toBe(300) // neighbour displaced
    // The dragged magnet is immovable during relax, so it lands where dragged.
    expect(a.x).toBe(300)
    // No overlap remains between the two boxes.
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    expect(overlapX <= 0 || overlapY <= 0).toBe(true)
  })
})

describe('setSurface', () => {
  it('re-clamps every magnet into the new bounds', () => {
    const magnets: Magnet[] = [
      { id: 1, type: 'letter', label: 'A', color: 'red', deg: 0, x: 500, y: 300, w: 52, h: 60, rot: 0, z: 1 },
    ]
    const s = boardReducer(initialBoardState(magnets), { type: 'setSurface', w: 200, h: 200 })
    const m = s.magnets[0]!
    expect(m.x).toBe(200 - 52)
    expect(m.y).toBe(200 - 60)
  })
})
