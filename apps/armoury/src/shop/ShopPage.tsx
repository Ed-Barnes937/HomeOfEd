import { useCallback, useEffect, useRef, useState } from 'react'

import { buildShareUrl } from '../share/shareLink.ts'
import { prefersShareSheet } from '../share/shareAction.ts'
import { renderShareCard } from '../share/shareCard.ts'
import { navigatorPictureTarget, pictureFilename, savePicture } from '../share/savePicture.ts'
import { useShareWand } from '../share/useShareWand.ts'
import { STAGE_FILL, type StageHandle } from '../stage/stage.ts'
import { PHONE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../useMediaQuery.ts'
import { useWorkbench } from '../workbench/WorkbenchProvider.tsx'
import { Panel } from './controls/Panel.tsx'
import { Sheet } from './controls/Sheet.tsx'
import { Header } from './Header.tsx'
import styles from './ShopPage.module.scss'
import type { ShopView } from './shopView.ts'

const KEPT_HOLD_MS = 1_800

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

export function ShopPage({ view }: { view: ShopView }) {
  const { item: def, copy, Scene } = view
  const { state, dispatch, shelf, keep } = useWorkbench(def.kind)
  const phone = useMediaQuery(PHONE_QUERY)
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const stageRef = useRef<StageHandle | null>(null)
  const [kept, setKept] = useState(false)
  const [pictureBusy, setPictureBusy] = useState(false)
  const { item } = state

  useEffect(() => {
    if (!kept) return
    const timer = setTimeout(() => setKept(false), KEPT_HOLD_MS)
    return () => clearTimeout(timer)
  }, [kept])

  const getShareUrl = useCallback(
    () => buildShareUrl(window.location.origin, def.kind, item),
    [def.kind, item],
  )
  const { shareState, share } = useShareWand(getShareUrl, copy)

  const name = item.name ?? def.name(item.params)

  const savePictureOfItem = async () => {
    if (!stageRef.current) return
    setPictureBusy(true)
    try {
      const capture = await stageRef.current.capture()
      const blob = await renderShareCard(view, {
        item: capture,
        captureFill: STAGE_FILL,
        lengthFraction: def.lengthFraction(item.params),
        number: def.number(item.params),
        name,
        description: def.tagLine(item.params),
        lore: def.lore(item.params),
        glowRgb: hexToRgb(def.glow(item.params)),
      })
      await savePicture(
        blob,
        pictureFilename(name, copy.pictureFallback),
        navigatorPictureTarget(navigator, document, prefersShareSheet()),
        copy.shareTitle,
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
            keep(item)
            setKept(true)
          }}
        >
          {kept ? 'On your shelf' : copy.keep}
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {kept ? `${name} is boxed and on your shelf.` : ''}
      </p>
    </div>
  )

  const controls = {
    schema: def.schema,
    groups: view.groups,
    widget: view.widget,
    copy,
    params: item.params,
    locked: state.locked,
    onChange: (key: string, value: string | number) => dispatch({ type: 'set', key, value }),
    onToggleLock: (group: string) => dispatch({ type: 'toggleLock', group }),
    actions,
  }

  return (
    <div className={styles.shop} data-shop={view.shop}>
      <main className={styles.main}>
        <Header
          copy={copy}
          shelfCount={shelf.length}
          shareState={shareState}
          onShare={share}
          pictureBusy={pictureBusy}
          onPicture={() => void savePictureOfItem()}
        />
        <Scene
          view={view}
          item={item}
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
