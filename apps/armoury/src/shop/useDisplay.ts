import { useRef, useState, type PointerEvent, type RefObject } from 'react'

import type { BoxPose, StageHandle } from '../stage/stage.ts'

const DRAG_SLOP_PX = 6
/** A drag across the whole display turns the item this far. */
const TURNS_PER_BOX = 0.8

/** The roll that brings `turns` to the nearest half turn, where the item lies flat. */
export function snapToFlat(turns: number): number {
  return Math.round(turns * 2) / 2 - turns + 0
}

/**
 * The item on display: a tap lifts it out for a close look, a sideways drag rolls it.
 * With `restsFlat`, letting go rolls it on to the nearest flat.
 */
export function useDisplay({
  stageRef,
  restsFlat = false,
}: {
  stageRef: RefObject<StageHandle | null>
  restsFlat?: boolean
}) {
  const [lifted, setLifted] = useState(false)
  const [empty, setEmpty] = useState(false)
  const drag = useRef<{ x: number; travelled: number } | null>(null)
  const moved = useRef(false)
  const turns = useRef(0)
  const stageSlot = useRef<HTMLSpanElement>(null)

  const boxPose = (): BoxPose => ({
    rect: stageSlot.current?.getBoundingClientRect() ?? new DOMRect(),
    turns: turns.current,
  })

  const letGo = () => {
    drag.current = null
    if (!restsFlat) return
    const residual = snapToFlat(turns.current)
    if (residual === 0) return
    turns.current += residual
    stageRef.current?.roll(residual)
  }

  const pointer = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { x: e.clientX, travelled: 0 }
      moved.current = false
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!drag.current) return
      const dx = e.clientX - drag.current.x
      drag.current = { x: e.clientX, travelled: drag.current.travelled + Math.abs(dx) }
      if (drag.current.travelled > DRAG_SLOP_PX) moved.current = true
      if (moved.current) {
        const rolled = (dx / e.currentTarget.clientWidth) * TURNS_PER_BOX
        turns.current += rolled
        stageRef.current?.roll(rolled)
      }
    },
    onPointerUp: letGo,
    onPointerCancel: letGo,
    onClick: () => {
      if (!moved.current) setLifted(true)
      moved.current = false
    },
  }

  return {
    lifted,
    empty,
    stageSlot,
    pointer,
    closeUp: {
      boxPose,
      onLift: () => setEmpty(true),
      onClosed: () => {
        setLifted(false)
        setEmpty(false)
      },
    },
  }
}
