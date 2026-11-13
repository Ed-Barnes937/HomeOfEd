import { useEffect, useImperativeHandle, useRef, useState } from 'react'

import { secretBlend } from '../potion/blends.ts'
import { isGold } from '../potion/describe.ts'
import { potionEffect } from '../potion/effects.ts'
import { potionMix } from '../potion/mix.ts'
import { isMixed } from '../potion/potionSchema.ts'
import { pourList } from '../potion/pours.ts'
import type { CloseUpHandle, CloseUpProps, StageHandle, StageProps } from '../stage/stage.ts'

/** Stands in for the potion's three.js stage in .iwft: shows what it was asked to draw. */
export function FakePotionStage({ params, ref }: StageProps) {
  useImperativeHandle(
    ref,
    (): StageHandle => ({
      roll: () => undefined,
      capture: () => {
        const canvas = document.createElement('canvas')
        canvas.width = 100
        canvas.height = 400
        return Promise.resolve(canvas)
      },
    }),
    [],
  )
  return (
    <div
      data-testid="stage"
      data-item="potion"
      data-shape={params.shape}
      data-neck={params.neck}
      data-glass={params.glass}
      data-stopper={params.stopper}
      data-label={params.label}
      data-pours={pourList(params).join(',')}
      data-mixed={isMixed(params) ? 'yes' : 'no'}
      data-outcome={potionMix(params)?.outcome ?? ''}
      data-gold={isGold(params) ? 'yes' : 'no'}
      data-effect={potionEffect(params)?.kind ?? 'none'}
      data-blend={secretBlend(params)?.id ?? 'none'}
    />
  )
}

/** The potion's close look without three.js; its two buttons stand in for where a tap lands. */
export function FakePotionCloseUpStage({
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
      data-item="potion"
      data-shape={params.shape}
      data-flourishes={flourishes}
    >
      <button type="button" data-testid="close-up-potion" tabIndex={-1} onClick={onTapItem} />
      <button type="button" data-testid="close-up-away" tabIndex={-1} onClick={onTapAway} />
    </div>
  )
}
