import { potionItem } from '../potion/item.ts'
import { MIX_REVEAL_SECONDS, MIX_REVEAL_SECONDS_REDUCED } from '../potion/mixBeats.ts'
import { isMixed } from '../potion/potionSchema.ts'
import { pourList } from '../potion/pours.ts'
import { paintApothecaryCard } from '../share/apothecaryCard.ts'
import type { ShopCopy, ShopView } from '../shop/shopView.ts'
import { BrewingTable } from './BrewingTable.tsx'
import { visibleGroups } from './potionGroups.ts'
import { potionWidget } from './potionWidgets.tsx'

export const apothecaryCopy: ShopCopy = {
  motto: 'potions mixed to order',
  sceneButton: 'Pick the bottle up',
  sceneHint: 'Tap the bottle to mix it',
  closeLookTitle: 'Your potion, up close',
  closeLookAction: 'Mix it',
  closeLookHint: 'Tap it to mix it. Drag to tip it.',
  keep: 'Keep this potion',
  kept: (name) => `${name} is on your shelf.`,
  nameField: 'Potion name',
  share: 'Share a link to this potion',
  shareTitle: 'Armoury',
  shareText: 'Look at the potion I made',
  picture: 'Save a picture of this potion',
  shelfLink: (count) => `Your shelf, ${count} potions`,
  panelTitle: 'Make your potion',
  sheetTitle: 'Parts of the potion',
  pictureFallback: 'potion',
}

export const apothecary: ShopView = {
  item: potionItem,
  path: '/potions',
  shop: 'apothecary',
  copy: apothecaryCopy,
  Scene: BrewingTable,
  groups: visibleGroups,
  widget: potionWidget,
  paintCard: paintApothecaryCard,
  closeUp: {
    flashDelaySeconds: null,
    flourishOnArrival: true,
    reveal: {
      seconds: MIX_REVEAL_SECONDS,
      reducedMotionSeconds: MIX_REVEAL_SECONDS_REDUCED,
      change: (p) =>
        pourList(p).length === 3 && !isMixed(p) ? { key: 'mixed', value: 'yes' } : null,
    },
  },
  offersPutBack: false,
}
