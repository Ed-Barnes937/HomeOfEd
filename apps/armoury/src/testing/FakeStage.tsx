import { useEffect, useImperativeHandle, useRef, useState } from 'react'

import type { Params } from '../engine/schema.ts'
import type {
  CloseUpHandle,
  CloseUpProps,
  StageHandle,
  StageProps,
  Stages,
} from '../stage/stage.ts'

import { compileWand } from '../wand/compile.ts'

const gemsLit = (params: Params) => {
  const spec = compileWand(params)
  return spec.gems.length + (spec.crystal ? 1 : 0) + (spec.orb ? 1 : 0)
}

/** Stands in for the three.js stage in .iwft: shows what it was asked to draw (ADR 0073). */
export function FakeStage({ params, ref }: StageProps) {
  useImperativeHandle(
    ref,
    (): StageHandle => ({
      roll: () => undefined,
      capture: () => {
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 100
        return Promise.resolve(canvas)
      },
    }),
    [],
  )
  return (
    <div
      data-testid="stage"
      data-wood={params.wood}
      data-core={params.core}
      data-length={params.lengthCm}
      data-gems={gemsLit(params)}
    />
  )
}

/** The close look without three.js; its two buttons stand in for where a tap lands. */
export function FakeCloseUpStage({
  params,
  onLift,
  onArrive,
  onTapWand,
  onTapAway,
  ref,
}: CloseUpProps) {
  const [casts, setCasts] = useState(0)
  const arrived = useRef(false)
  useImperativeHandle(
    ref,
    (): CloseUpHandle => ({
      cast: () => setCasts((c) => c + 1),
      putBack: () => Promise.resolve(),
    }),
    [],
  )
  useEffect(() => {
    if (arrived.current) return
    arrived.current = true
    onLift()
    onArrive()
  }, [onLift, onArrive])
  return (
    <div
      data-testid="close-up-stage"
      data-wood={params.wood}
      data-casts={casts}
      data-gems={gemsLit(params)}
    >
      <button type="button" data-testid="close-up-wand" tabIndex={-1} onClick={onTapWand} />
      <button type="button" data-testid="close-up-away" tabIndex={-1} onClick={onTapAway} />
    </div>
  )
}

export const fakeStages: Stages = { Box: FakeStage, CloseUp: FakeCloseUpStage }
