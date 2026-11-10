import { Suspense, use, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

import type { StoredItem } from '../items/item.ts'
import {
  StageContext,
  WAVE_TO_SPELL_SECONDS,
  type BoxPose,
  type CloseUpHandle,
} from '../stage/stage.ts'
import { wandDescription, wandName } from '../wand/describe.ts'
import { swatchFor } from '../wand/wandSchema.ts'
import styles from './CloseUp.module.scss'

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/** The wand lifted out of its box into the middle of the darkened shop, to turn and wave. */
export function CloseUp({
  wand,
  reducedMotion,
  boxPose,
  onLift,
  onClosed,
}: {
  wand: StoredItem
  reducedMotion: boolean
  boxPose: () => BoxPose
  onLift: () => void
  onClosed: () => void
}) {
  const Stage = use(StageContext)?.CloseUp
  const dialog = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<CloseUpHandle | null>(null)
  const [casts, setCasts] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useLayoutEffect(() => {
    dialog.current?.showModal()
  }, [])

  const wave = () => {
    stageRef.current?.cast()
    setCasts((c) => c + 1)
  }

  const finish = () => {
    if (dialog.current?.open) dialog.current.close()
    onClosed()
  }

  const putBack = async () => {
    if (leaving) return
    setLeaving(true)
    await stageRef.current?.putBack()
    finish()
  }

  const { params } = wand
  return (
    <dialog
      ref={dialog}
      className={styles.closeUp}
      aria-label="Your wand, up close"
      data-leaving={leaving || undefined}
      style={
        {
          '--core-rgb': hexToRgb(swatchFor('core', params.core as string) ?? '#ffc95c'),
          '--spell-delay': `${reducedMotion ? 0 : WAVE_TO_SPELL_SECONDS}s`,
        } as CSSProperties
      }
      onCancel={(e) => {
        e.preventDefault()
        void putBack()
      }}
      onClose={() => {
        if (!leaving) onClosed()
      }}
    >
      <div className={styles.shade} aria-hidden="true" />
      {casts > 0 && <div key={casts} className={styles.flash} aria-hidden="true" />}
      <div className={styles.stage}>
        {Stage && (
          <Suspense fallback={null}>
            <Stage
              ref={stageRef}
              params={params}
              reducedMotion={reducedMotion}
              boxPose={boxPose}
              onLift={onLift}
              onArrive={wave}
              onTapWand={wave}
              onTapAway={() => void putBack()}
            />
          </Suspense>
        )}
      </div>
      <div className={styles.caption}>
        <h2 className={styles.name}>{wand.name ?? wandName(params)}</h2>
        <p className={styles.description}>{wandDescription(params)}</p>
        <p className={styles.hint}>Drag to turn it. Tap it to wave.</p>
        <div className={styles.buttons}>
          <button type="button" className={styles.wave} onClick={wave}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M10 2 v4 M10 14 v4 M2 10 h4 M14 10 h4 M4.5 4.5 l2.5 2.5 M13 13 l2.5 2.5 M15.5 4.5 l-2.5 2.5 M7 13 l-2.5 2.5" />
            </svg>
            Wave it
          </button>
          <button type="button" className={styles.putBack} autoFocus onClick={() => void putBack()}>
            Put it back
          </button>
        </div>
      </div>
    </dialog>
  )
}
