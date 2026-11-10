import { Suspense, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

import type { StoredItem } from '../items/item.ts'
import { useStages, type BoxPose, type CloseUpHandle } from '../stage/stage.ts'
import styles from './CloseUp.module.scss'
import type { ShopView } from './shopView.ts'

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/** The item lifted out into the middle of the darkened shop, to turn and show off. */
export function CloseUp({
  view,
  item,
  reducedMotion,
  boxPose,
  onLift,
  onClosed,
}: {
  view: ShopView
  item: StoredItem
  reducedMotion: boolean
  boxPose: () => BoxPose
  onLift: () => void
  onClosed: () => void
}) {
  const Stage = useStages(view.item.kind)?.CloseUp
  const dialog = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<CloseUpHandle | null>(null)
  const [flourishes, setFlourishes] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useLayoutEffect(() => {
    dialog.current?.showModal()
  }, [])

  const flourish = () => {
    stageRef.current?.flourish()
    setFlourishes((c) => c + 1)
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

  const { params } = item
  const { copy, closeUp } = view
  return (
    <dialog
      ref={dialog}
      className={styles.closeUp}
      aria-label={copy.closeLookTitle}
      data-leaving={leaving || undefined}
      style={
        {
          '--core-rgb': hexToRgb(view.item.glow(params)),
          '--spell-delay': `${reducedMotion ? 0 : (closeUp.flashDelaySeconds ?? 0)}s`,
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
      {flourishes > 0 && closeUp.flashDelaySeconds !== null && (
        <div key={flourishes} className={styles.flash} aria-hidden="true" />
      )}
      <div className={styles.stage}>
        {Stage && (
          <Suspense fallback={null}>
            <Stage
              ref={stageRef}
              params={params}
              reducedMotion={reducedMotion}
              boxPose={boxPose}
              onLift={onLift}
              onArrive={flourish}
              onTapItem={flourish}
              onTapAway={() => void putBack()}
            />
          </Suspense>
        )}
      </div>
      <div className={styles.caption}>
        <h2 className={styles.name}>{item.name ?? view.item.name(params)}</h2>
        <p className={styles.description}>{view.item.tagLine(params)}</p>
        <p className={styles.hint}>{copy.closeLookHint}</p>
        <div className={styles.buttons}>
          <button type="button" className={styles.wave} onClick={flourish}>
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
            {copy.closeLookAction}
          </button>
          <button type="button" className={styles.putBack} autoFocus onClick={() => void putBack()}>
            Put it back
          </button>
        </div>
      </div>
    </dialog>
  )
}
