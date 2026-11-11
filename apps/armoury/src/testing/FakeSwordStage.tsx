import { useEffect, useImperativeHandle, useRef, useState } from 'react'

import type { CloseUpHandle, CloseUpProps, StageHandle, StageProps } from '../stage/stage.ts'
import { compileSword } from '../sword/compile.ts'

/** Stands in for the sword's three.js stage in .iwft: shows what it was asked to draw. */
export function FakeSwordStage({ params, ref }: StageProps) {
  const spec = compileSword(params)
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
      data-item="sword"
      data-family={spec.family}
      data-length-mm={Math.round(spec.lengthMm)}
      data-guard={spec.guard.style}
      data-grip={spec.grip.wrap}
      data-pommel={spec.pommel.style}
      data-runes={spec.runes?.where ?? 'none'}
      data-gems={spec.gems.length}
      data-steel={params.steel}
      data-tip={params.tip}
    />
  )
}

/** The sword's close look without three.js; its two buttons stand in for where a tap lands. */
export function FakeSwordCloseUpStage({
  params,
  onLift,
  onArrive,
  onTapItem,
  onTapAway,
  ref,
}: CloseUpProps) {
  const [flourishes, setFlourishes] = useState(0)
  const arrived = useRef(false)
  useImperativeHandle(
    ref,
    (): CloseUpHandle => ({
      flourish: () => setFlourishes((c) => c + 1),
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
      data-item="sword"
      data-family={params.family}
      data-flourishes={flourishes}
    >
      <button type="button" data-testid="close-up-sword" tabIndex={-1} onClick={onTapItem} />
      <button type="button" data-testid="close-up-away" tabIndex={-1} onClick={onTapAway} />
    </div>
  )
}
