import type { ComponentType, ReactNode, RefObject } from 'react'

import type { ParamDef, ParamValue, Params } from '../engine/schema.ts'
import type { ItemDef, StoredItem } from '../items/item.ts'
import type { ShopPath } from '../landing.ts'
import type { CardContent } from '../share/shareCard.ts'
import type { StageHandle } from '../stage/stage.ts'
import type { OnChange } from './controls/Widgets.tsx'

/** Every string in a shop that names its item. */
export interface ShopCopy {
  motto: string
  sceneButton: string
  sceneHint: string
  closeLookTitle: string
  closeLookAction: string
  closeLookHint: string
  keep: string
  /** Read out once the item is on the shelf. */
  kept: (name: string) => string
  nameField: string
  share: string
  shareTitle: string
  shareText: string
  picture: string
  shelfLink: (count: number) => string
  panelTitle: string
  sheetTitle: string
  pictureFallback: string
}

export interface GroupMeta {
  key: string
  /** Counted over the groups shown, so there's never a gap. */
  numeral: string
  title: string
  /** The short phone tab label. */
  tab: string
  summary: (p: Params) => string
  /** On the phone sheet, the lock rides the tab row and the summary is read but not drawn. */
  lockInTabRow?: boolean
}

export interface SceneProps {
  view: ShopView
  item: StoredItem
  arrivals: number
  reducedMotion: boolean
  stageRef: RefObject<StageHandle | null>
  onRename: (name: string) => void
}

export interface WidgetProps {
  params: Params
  onChange: OnChange
  /** Labels beside their pills, for a compact row. */
  inline: boolean
}

export interface ShopView {
  item: ItemDef
  path: ShopPath
  /** The root's `data-shop`; tokens.scss overrides palette tokens under it. */
  shop: 'wands' | 'smithy' | 'apothecary'
  copy: ShopCopy
  Scene: ComponentType<SceneProps>
  groups: (p: Params) => GroupMeta[]
  /** A control of the shop's own for this param, or undefined for the plain one. */
  widget?: (def: ParamDef, props: WidgetProps) => ReactNode | undefined
  paintCard: (ctx: CanvasRenderingContext2D, content: CardContent) => void
  closeUp: {
    /** Seconds from a flourish to the screen's flash; null for no flash. */
    flashDelaySeconds: number | null
    /** Whether the item shows off as soon as it arrives, or waits for a tap. */
    flourishOnArrival: boolean
    /** A change the item makes to itself a while after each flourish, or when the close look closes first. */
    reveal?: {
      seconds: number
      reducedMotionSeconds: number
      change: (p: Params) => { key: string; value: ParamValue } | null
    }
  }
  /** Whether "Put the last one back" is offered; the workbench records `previous` either way. */
  offersPutBack?: boolean
}
