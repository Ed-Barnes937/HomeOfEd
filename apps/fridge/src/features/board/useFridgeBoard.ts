import {
  clampOne,
  findOpenPlacement,
  knobRotation,
  type Placement,
  relax,
  snapRotation,
  spawnPlacement,
  wheelRotation,
} from '@hoe/magnet-kit'
import { type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { CANVAS_H, CANVAS_W, toLogical } from './canvas.ts'
import {
  type Finish,
  type Magnet,
  type MagnetType,
  PALETTE_ORDER,
  type PaletteKey,
  sizeFor,
  type Wall,
} from './model.ts'
import { fromStoredBoard, loadState, saveState, type StoredBoard, toStoredBoard } from './serialize.ts'

/** What a tray tile asks to spawn: the type plus its glyph/label and wedge. */
export interface SpawnOpts {
  type: MagnetType
  label: string
  deg: number
}

/**
 * All board render state. Counters (`nextId`, `zTop`, `colorCursor`) live here
 * rather than in refs so the reducer stays pure and deterministic — the plan's
 * F5 reducer tests depend on that, and StrictMode double-invokes reducers.
 * Transient gesture data (drag grab-offset, rotation centre) stays in refs.
 *
 * Coordinates are bound to the fixed logical canvas (CANVAS_W×CANVAS_H, see
 * canvas.ts / ADR 0022), never a measured DOM surface — so a board is
 * pixel-identical on every device. The stage measurement drives only the
 * render scale (useBoardView), not the coordinate space.
 */
export interface BoardState {
  magnets: Magnet[]
  selId: number | null
  dragId: number | null
  finish: Finish
  wall: Wall
  pick: number | null // palette index, or null = auto-cycle
  nextId: number
  zTop: number
  colorCursor: number // last auto colour index; -1 so the first auto pick is red
  name: string // the active (not necessarily yet-saved) board's name
  sweeping: boolean // true while the "empty the fridge" sweep animates out
}

type Action =
  | { type: 'add'; opts: SpawnOpts; placement: Placement }
  | { type: 'startDrag'; id: number }
  | { type: 'moveDrag'; id: number; x: number; y: number }
  | { type: 'endDrag' }
  | { type: 'select'; id: number | null }
  | { type: 'setRot'; id: number; rot: number }
  | { type: 'snapRot'; id: number }
  | { type: 'wheelRot'; id: number; deltaY: number }
  | { type: 'remove'; id: number }
  | { type: 'startSweep' }
  | { type: 'clear' }
  | { type: 'setFinish'; finish: Finish }
  | { type: 'setWall'; wall: Wall }
  | { type: 'setPick'; pick: number | null }
  | { type: 'setName'; name: string }
  | { type: 'loadBoard'; magnets: Magnet[]; finish: Finish; wall: Wall; name: string }
  | { type: 'newBoard' }

const clone = (magnets: Magnet[]): Magnet[] => magnets.map((m) => ({ ...m }))

/** The colour a new magnet gets: the picked swatch, or the next auto-cycle key. */
function resolveColor(state: BoardState): { color: PaletteKey; colorCursor: number } {
  if (state.pick !== null) {
    return { color: PALETTE_ORDER[state.pick]!, colorCursor: state.colorCursor }
  }
  const colorCursor = (state.colorCursor + 1) % PALETTE_ORDER.length
  return { color: PALETTE_ORDER[colorCursor]!, colorCursor }
}

/**
 * Compute the spawn placement for a new magnet (uses the injected rng) and
 * return the `add` action. Kept separate from the reducer so the rng call
 * happens in the event handler — not inside the pure, StrictMode-doubled
 * reducer — and so tests can drive spawn+relax with a seeded rng.
 */
export function buildAddAction(magnets: Magnet[], opts: SpawnOpts, rng: () => number): Action {
  const size = sizeFor(opts.type)
  // Prefer an open spot so a new magnet doesn't shove ones already placed (#43);
  // findOpenPlacement falls back to the raw spawn point on a full board, where
  // the reducer's relax() then shoves neighbours as before. Bounds are the fixed
  // logical canvas (ADR 0022), not a measured surface — so where a magnet lands
  // is device-independent, matching the coordinate model.
  const preferred = spawnPlacement(CANVAS_W, CANVAS_H, size, rng)
  const placement = findOpenPlacement(magnets, CANVAS_W, CANVAS_H, size, preferred)
  return { type: 'add', opts, placement }
}

function idAndZTop(magnets: Magnet[]): { nextId: number; zTop: number } {
  const nextId = magnets.reduce((max, m) => Math.max(max, m.id), 0) + 1
  const zTop = magnets.reduce((max, m) => Math.max(max, m.z), 0)
  return { nextId, zTop }
}

export function boardReducer(state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case 'add': {
      // The board is read-only while it sweeps out — a magnet added now would
      // just be wiped by the pending clear(). See startSweep.
      if (state.sweeping) return state
      const size = sizeFor(action.opts.type)
      const { color, colorCursor } = resolveColor(state)
      const id = state.nextId
      const z = state.zTop + 1
      const magnet: Magnet = {
        id,
        type: action.opts.type,
        label: action.opts.label,
        deg: action.opts.deg,
        color,
        x: action.placement.x,
        y: action.placement.y,
        w: size.w,
        h: size.h,
        rot: action.placement.rot,
        z,
      }
      const magnets = clone(state.magnets)
      magnets.push(magnet)
      relax(magnets, id, CANVAS_W, CANVAS_H)
      return { ...state, magnets, selId: id, nextId: id + 1, zTop: z, colorCursor }
    }
    case 'startDrag': {
      const z = state.zTop + 1
      const magnets = state.magnets.map((m) => (m.id === action.id ? { ...m, z } : m))
      return { ...state, magnets, dragId: action.id, selId: action.id, zTop: z }
    }
    case 'moveDrag': {
      const magnets = clone(state.magnets)
      const a = magnets.find((m) => m.id === action.id)
      if (!a) return state
      a.x = action.x
      a.y = action.y
      clampOne(a, CANVAS_W, CANVAS_H)
      relax(magnets, action.id, CANVAS_W, CANVAS_H)
      return { ...state, magnets }
    }
    case 'endDrag':
      return { ...state, dragId: null }
    case 'select':
      return { ...state, selId: action.id }
    case 'setRot': {
      const magnets = state.magnets.map((m) => (m.id === action.id ? { ...m, rot: action.rot } : m))
      return { ...state, magnets }
    }
    case 'snapRot': {
      const magnets = state.magnets.map((m) =>
        m.id === action.id ? { ...m, rot: snapRotation(m.rot) } : m,
      )
      return { ...state, magnets }
    }
    case 'wheelRot': {
      const magnets = state.magnets.map((m) =>
        m.id === action.id ? { ...m, rot: wheelRotation(m.rot, action.deltaY) } : m,
      )
      return { ...state, magnets, selId: action.id }
    }
    case 'remove': {
      const magnets = state.magnets.filter((m) => m.id !== action.id)
      return {
        ...state,
        magnets,
        selId: state.selId === action.id ? null : state.selId,
        dragId: state.dragId === action.id ? null : state.dragId,
      }
    }
    case 'startSweep':
      // No-op on an empty board (a no-op sweep looks broken) or while a sweep
      // is already running (guards double-trigger). Magnets stay on the board;
      // they animate out and clear() empties them when the motion finishes.
      if (state.magnets.length === 0 || state.sweeping) return state
      return { ...state, sweeping: true, selId: null }
    case 'clear':
      // Ends any in-flight sweep — this is what the sweep's completion calls,
      // and New/clear must not strand the flag.
      return { ...state, magnets: [], selId: null, dragId: null, sweeping: false }
    case 'setFinish':
      return { ...state, finish: action.finish }
    case 'setWall':
      return { ...state, wall: action.wall }
    case 'setPick':
      return { ...state, pick: action.pick }
    case 'setName':
      return { ...state, name: action.name }
    case 'loadBoard': {
      // Read-only mid-sweep: loading now would flash a board the pending
      // clear() then wipes. Ignore until the sweep finishes.
      if (state.sweeping) return state
      const { nextId, zTop } = idAndZTop(action.magnets)
      return {
        ...state,
        magnets: clone(action.magnets),
        finish: action.finish,
        wall: action.wall,
        name: action.name,
        selId: null,
        dragId: null,
        nextId,
        zTop,
      }
    }
    case 'newBoard':
      return { ...state, magnets: [], selId: null, dragId: null, name: '' }
  }
}

/** Build the initial board state from a set of starting magnets. */
export function initialBoardState(
  magnets: Magnet[],
  finish: Finish = 'mint',
  wall: Wall = 'warm',
  name = '',
): BoardState {
  const { nextId, zTop } = idAndZTop(magnets)
  return {
    magnets: clone(magnets),
    selId: null,
    dragId: null,
    finish,
    wall,
    pick: null,
    nextId,
    zTop,
    colorCursor: -1,
    name,
    sweeping: false,
  }
}

export interface UseFridgeBoard {
  state: BoardState
  saved: StoredBoard[]
  surfaceRef: React.RefObject<HTMLDivElement | null>
  add: (opts: SpawnOpts) => void
  clear: () => void
  startSweep: () => void
  setPick: (pick: number | null) => void
  setFinish: (finish: Finish) => void
  setWall: (wall: Wall) => void
  setName: (name: string) => void
  save: (name: string) => void
  loadSaved: (name: string) => void
  deleteSaved: (name: string) => void
  newBoard: () => void
  onMagnetPointerDown: (e: ReactPointerEvent<HTMLDivElement>, id: number) => void
  onMagnetPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onMagnetPointerUp: () => void
  onMagnetWheel: (e: ReactWheelEvent<HTMLDivElement>, id: number) => void
  onMagnetDoubleClick: (id: number) => void
  onSurfacePointerDown: () => void
  onKnobPointerDown: (e: ReactPointerEvent<HTMLDivElement>, id: number) => void
  onKnobPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onKnobPointerUp: () => void
}

/**
 * Owns the board reducer, measures the surface, and wires every gesture to an
 * engine call (drag→relax, knob→knobRotation/snapRotation, wheel→wheelRotation,
 * tap→spawnPlacement+relax). All collision/placement/rotation maths comes from
 * `@hoe/magnet-kit`; this hook only translates pointer events into actions.
 */
export function useFridgeBoard(options?: {
  initialMagnets?: Magnet[]
  rng?: () => number
}): UseFridgeBoard {
  const rng = options?.rng ?? Math.random

  // Loaded once, lazily (mirrors boids' `useState(() => loadSettings(...))`):
  // an explicit `initialMagnets` override skips localStorage entirely (for
  // future direct-hook tests); otherwise read the persisted board, or the
  // seed on first-ever load / corrupt storage — serialize.ts never throws.
  const [initial] = useState<{
    magnets: Magnet[]
    finish: Finish
    wall: Wall
    name: string
    saved: StoredBoard[]
  }>(() => {
    if (options?.initialMagnets !== undefined) {
      return { magnets: options.initialMagnets, finish: 'mint', wall: 'warm', name: '', saved: [] }
    }
    const { current, saved } = loadState(window.localStorage)
    const { magnets, finish, wall } = fromStoredBoard(current)
    return { magnets, finish, wall, name: current.name, saved }
  })

  const [state, dispatch] = useReducer(
    boardReducer,
    initialBoardState(initial.magnets, initial.finish, initial.wall, initial.name),
  )
  const [saved, setSaved] = useState<StoredBoard[]>(initial.saved)

  // Measured for pointer→logical conversion only: its on-screen rect reflects
  // the fit scale + any view zoom/pan, so `toLogical` divides by rect.width /
  // CANVAS_W to track the cursor exactly (ADR 0022). It no longer drives bounds.
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  // Drag grab-offset and rotation centre are both kept in LOGICAL canvas px.
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null)
  const rotRef = useRef<{ id: number; cx: number; cy: number } | null>(null)
  const sweepTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest state for event handlers, so they can stay stable (empty deps)
  // without reading stale surface size / magnet positions.
  const stateRef = useRef(state)
  stateRef.current = state
  const savedRef = useRef(saved)
  savedRef.current = saved

  // Persist the current board + saved list on every mutation (the
  // reference's "serialized on every mutation") — an effect because this is
  // useReducer-backed, unlike boids' useState-based settings persistence.
  useEffect(() => {
    const current = toStoredBoard(state.name, state.magnets, state.finish, state.wall)
    saveState(window.localStorage, current, saved)
  }, [state.magnets, state.finish, state.wall, state.name, saved])

  const add = useCallback(
    (opts: SpawnOpts) => dispatch(buildAddAction(stateRef.current.magnets, opts, rng)),
    [rng],
  )
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  // "Empty the fridge": sweep the magnets off the bottom edge, then clear.
  // The sweep is a CSS transition on each MagnetView (see its `departing`
  // state); completion is driven off a single timer sized to the longest
  // magnet's stagger + duration (~960ms, see plan 0005 §4), rounded to 1000ms.
  // No per-element transitionend listener — the timer is the mechanism, so a
  // magnet already at opacity:0 (no transition fired) can't strand the sweep.
  const startSweep = useCallback(() => {
    if (stateRef.current.magnets.length === 0 || stateRef.current.sweeping) return
    // Respect reduced motion: skip the animation, empty immediately (today's
    // instant behaviour).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dispatch({ type: 'clear' })
      return
    }
    dispatch({ type: 'startSweep' })
    sweepTimer.current = setTimeout(() => {
      sweepTimer.current = null
      dispatch({ type: 'clear' })
    }, 1000)
  }, [])

  // Cancel an in-flight sweep timer on unmount so it can't fire after teardown.
  useEffect(() => {
    return () => {
      if (sweepTimer.current) clearTimeout(sweepTimer.current)
    }
  }, [])
  const setPick = useCallback((pick: number | null) => dispatch({ type: 'setPick', pick }), [])
  const setFinish = useCallback((finish: Finish) => dispatch({ type: 'setFinish', finish }), [])
  const setWall = useCallback((wall: Wall) => dispatch({ type: 'setWall', wall }), [])
  const setName = useCallback((name: string) => dispatch({ type: 'setName', name }), [])

  /** Upserts the current arrangement under the typed name (by name), falling
   * back to the active name, else "Fridge N" — matches the reference. */
  const save = useCallback((typedName: string) => {
    // Don't snapshot a board that's mid-sweep — it would save the magnets that
    // are about to be cleared. The Save button is also disabled while sweeping;
    // this guards non-UI callers.
    if (stateRef.current.sweeping) return
    const trimmed = typedName.trim()
    const resolvedName = trimmed || `Fridge ${savedRef.current.length + 1}`
    const board = toStoredBoard(
      resolvedName,
      stateRef.current.magnets,
      stateRef.current.finish,
      stateRef.current.wall,
    )
    setSaved((prev) => {
      const idx = prev.findIndex((b) => b.name === resolvedName)
      if (idx >= 0) {
        const next = prev.slice()
        next[idx] = board
        return next
      }
      return [...prev, board]
    })
    dispatch({ type: 'setName', name: resolvedName })
  }, [])

  const loadSaved = useCallback((name: string) => {
    const board = savedRef.current.find((b) => b.name === name)
    if (!board) return
    const { magnets, finish, wall } = fromStoredBoard(board)
    dispatch({ type: 'loadBoard', magnets, finish, wall, name: board.name })
  }, [])

  const deleteSaved = useCallback((name: string) => {
    setSaved((prev) => prev.filter((b) => b.name !== name))
  }, [])

  const newBoard = useCallback(() => dispatch({ type: 'newBoard' }), [])

  const onMagnetPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>, id: number) => {
    e.stopPropagation()
    const el = surfaceRef.current
    const m = stateRef.current.magnets.find((x) => x.id === id)
    if (!el || !m) return
    // Grab-offset in logical px: toLogical divides out the render scale/zoom.
    const l = toLogical(el.getBoundingClientRect(), e.clientX, e.clientY)
    dragRef.current = { id, dx: l.x - m.x, dy: l.y - m.y }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* not supported in some test envs */
    }
    dispatch({ type: 'startDrag', id })
  }, [])

  const onMagnetPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const el = surfaceRef.current
    if (!el) return
    const l = toLogical(el.getBoundingClientRect(), e.clientX, e.clientY)
    dispatch({ type: 'moveDrag', id: drag.id, x: l.x - drag.dx, y: l.y - drag.dy })
  }, [])

  const onMagnetPointerUp = useCallback(() => {
    if (!dragRef.current) return
    dragRef.current = null
    dispatch({ type: 'endDrag' })
  }, [])

  const onMagnetWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>, id: number) => {
    dispatch({ type: 'wheelRot', id, deltaY: e.deltaY })
  }, [])

  const onMagnetDoubleClick = useCallback((id: number) => dispatch({ type: 'remove', id }), [])

  const onSurfacePointerDown = useCallback(() => dispatch({ type: 'select', id: null }), [])

  const onKnobPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>, id: number) => {
    e.stopPropagation()
    const m = stateRef.current.magnets.find((x) => x.id === id)
    if (!m) return
    // Rotation centre in logical px; the pointer is converted to logical on
    // move, so the angle is correct at any render scale/zoom.
    rotRef.current = { id, cx: m.x + m.w / 2, cy: m.y + m.h / 2 }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* not supported in some test envs */
    }
  }, [])

  const onKnobPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const rot = rotRef.current
    if (!rot) return
    const el = surfaceRef.current
    if (!el) return
    const p = toLogical(el.getBoundingClientRect(), e.clientX, e.clientY)
    dispatch({ type: 'setRot', id: rot.id, rot: knobRotation(rot.cx, rot.cy, p.x, p.y) })
  }, [])

  const onKnobPointerUp = useCallback(() => {
    const rot = rotRef.current
    if (!rot) return
    dispatch({ type: 'snapRot', id: rot.id })
    rotRef.current = null
  }, [])

  return {
    state,
    saved,
    surfaceRef,
    add,
    clear,
    startSweep,
    setPick,
    setFinish,
    setWall,
    setName,
    save,
    loadSaved,
    deleteSaved,
    newBoard,
    onMagnetPointerDown,
    onMagnetPointerMove,
    onMagnetPointerUp,
    onMagnetWheel,
    onMagnetDoubleClick,
    onSurfacePointerDown,
    onKnobPointerDown,
    onKnobPointerMove,
    onKnobPointerUp,
  }
}
