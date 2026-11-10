import { useCallback, useEffect, useRef, useState } from 'react'

import { useFamilySession } from '../familySession.tsx'
import { buildShareUrl } from '../share/shareLink.ts'
import { prefersShareSheet } from '../share/shareAction.ts'
import { renderShareCard } from '../share/shareCard.ts'
import { navigatorPictureTarget, savePicture, wandFilename } from '../share/savePicture.ts'
import { useKeepShared } from '../share/useKeepShared.ts'
import { useShareWand } from '../share/useShareWand.ts'
import { LONGEST_WAND_MM, STAGE_FILL, type StageHandle } from '../stage/stage.ts'
import { PHONE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../useMediaQuery.ts'
import { wandDescription, wandLore, wandName, wandNumber } from '../wand/describe.ts'
import { swatchFor } from '../wand/wandSchema.ts'
import { useWorkbench } from '../workbench/WorkbenchProvider.tsx'
import { Panel } from './controls/Panel.tsx'
import { Sheet } from './controls/Sheet.tsx'
import { Counter } from './Counter.tsx'
import { Header } from './Header.tsx'
import styles from './ShopPage.module.scss'

const KEPT_HOLD_MS = 1_800

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

/** `shared`: the `/shared` view, which keeps nothing, so "Keep this wand" takes the wand to the root. */
export function ShopPage({ shared = false }: { shared?: boolean }) {
  const { state, dispatch, shelf, keep } = useWorkbench()
  const player = useFamilySession()
  const phone = useMediaQuery(PHONE_QUERY)
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const stageRef = useRef<StageHandle | null>(null)
  const [kept, setKept] = useState(false)
  const [pictureBusy, setPictureBusy] = useState(false)
  const { wand } = state

  useEffect(() => {
    if (!kept) return
    const timer = setTimeout(() => setKept(false), KEPT_HOLD_MS)
    return () => clearTimeout(timer)
  }, [kept])

  const getShareUrl = useCallback(() => buildShareUrl(window.location.origin, wand), [wand])
  const { shareState, share } = useShareWand(getShareUrl)
  const keepShared = useKeepShared(wand)

  const name = wand.name ?? wandName(wand.params)

  const savePictureOfWand = async () => {
    if (!stageRef.current) return
    setPictureBusy(true)
    try {
      const capture = await stageRef.current.capture()
      const blob = await renderShareCard({
        wand: capture,
        captureFill: STAGE_FILL,
        lengthFraction: ((wand.params.lengthCm as number) * 10) / LONGEST_WAND_MM,
        number: wandNumber(wand.params),
        name,
        description: wandDescription(wand.params),
        lore: wandLore(wand.params),
        coreRgb: hexToRgb(swatchFor('core', wand.params.core as string) ?? '#ffc95c'),
      })
      await savePicture(
        blob,
        wandFilename(name),
        navigatorPictureTarget(navigator, document, prefersShareSheet()),
      )
    } finally {
      setPictureBusy(false)
    }
  }

  const actions = (
    <div className={styles.actions}>
      {state.previous && (
        <button
          type="button"
          className={styles.putBack}
          onClick={() => dispatch({ type: 'putBack' })}
        >
          Put the last one back
        </button>
      )}
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.secondary}
          onClick={() =>
            dispatch({ type: 'tryAnother', seed: Math.floor(Math.random() * 2 ** 31) })
          }
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1.5" y="7" width="15" height="5" rx="0.8" />
            <path d="M2.5 7 L4 3.5 H14 L15.5 7" />
          </svg>
          Try another
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            if (shared) return keepShared()
            keep(wand)
            setKept(true)
          }}
        >
          {kept ? 'On your shelf' : 'Keep this wand'}
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {kept ? `${name} is boxed and on your shelf.` : ''}
      </p>
    </div>
  )

  const controls = {
    params: wand.params,
    locked: state.locked,
    onChange: (key: string, value: string | number) => dispatch({ type: 'set', key, value }),
    onToggleLock: (group: string) => dispatch({ type: 'toggleLock', group }),
    actions,
  }

  return (
    <div className={styles.shop}>
      <main className={styles.main}>
        <Header
          shelfCount={shared ? null : shelf.length}
          player={shared ? null : (player?.name ?? null)}
          shareState={shareState}
          onShare={share}
          pictureBusy={pictureBusy}
          onPicture={() => void savePictureOfWand()}
        />
        <Counter
          wand={wand}
          arrivals={state.arrivals}
          reducedMotion={reducedMotion}
          stageRef={stageRef}
          onRename={(next) => dispatch({ type: 'rename', name: next })}
        />
      </main>
      <div className={styles.controls}>
        {phone ? <Sheet {...controls} /> : <Panel {...controls} />}
      </div>
    </div>
  )
}
