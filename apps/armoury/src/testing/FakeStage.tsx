import { useEffect, useImperativeHandle, useRef, useState } from 'react'

import type { Params } from '../engine/schema.ts'
import type {
  CloseUpHandle,
  CloseUpProps,
  StageHandle,
  StageProps,
  StagesByKind,
} from '../stage/stage.ts'

import { compileWand } from '../wand/compile.ts'

const gemCount = (params: Params) => {
  const spec = compileWand(params)
  return spec.gems.length + (spec.crystal ? 1 : 0) + (spec.orb ? 1 : 0)
}

/** Stands in for the three.js stage in .iwft: shows what it was asked to draw (ADR 0073). */
export function FakeStage({ params, ref }: StageProps) {
  const spec = compileWand(params)
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
      data-kind={params.kind}
      data-wood={params.wood}
      data-core={params.core}
      data-length={params.lengthCm}
      data-gems={gemCount(params)}
      data-stencil={spec.stencil?.tile ?? 'none'}
      data-branch={params.branchSeed}
      data-bark={spec.branch?.bark?.cover ?? 'none'}
      data-gem-colour={spec.gemColour.glow}
      data-gem-cut={spec.gems[0]?.cut ?? 'none'}
      data-crystal={spec.crystal?.shape ?? 'none'}
    />
  )
}

/** The close look without three.js; its two buttons stand in for where a tap lands. */
export function FakeCloseUpStage({
  params,
  onLift,
  onArrive,
  onTapItem,
  onTapAway,
  ref,
}: CloseUpProps) {
  const [casts, setCasts] = useState(0)
  const arrived = useRef(false)
  useImperativeHandle(
    ref,
    (): CloseUpHandle => ({
      flourish: () => setCasts((c) => c + 1),
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
      data-gems={gemCount(params)}
    >
      <button type="button" data-testid="close-up-wand" tabIndex={-1} onClick={onTapItem} />
      <button type="button" data-testid="close-up-away" tabIndex={-1} onClick={onTapAway} />
    </div>
  )
}

export const fakeStages: StagesByKind = {
  wand: { Box: FakeStage, CloseUp: FakeCloseUpStage },
}
