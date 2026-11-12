import { paintWandCard } from '../share/wandCard.ts'
import { WAVE_TO_SPELL_SECONDS } from '../stage/stage.ts'
import { wandItem } from '../wand/item.ts'
import { visibleGroups } from './controls/groups.ts'
import { wandWidget } from './controls/wandWidgets.tsx'
import { Counter } from './Counter.tsx'
import type { ShopCopy, ShopView } from './shopView.ts'

export const wandCopy: ShopCopy = {
  motto: 'wands made to measure',
  sceneButton: 'Give the wand a wave',
  sceneHint: 'Tap the wand to give it a wave',
  closeLookTitle: 'Your wand, up close',
  closeLookAction: 'Wave it',
  closeLookHint: 'Drag to turn it. Tap it to wave.',
  keep: 'Keep this wand',
  kept: (name) => `${name} is boxed and on your shelf.`,
  nameField: 'Wand name',
  share: 'Share a link to this wand',
  shareTitle: 'Armoury',
  shareText: 'Look at the wand I made',
  picture: 'Save a picture of this wand',
  shelfLink: (count) => `Your shelf, ${count} wands`,
  panelTitle: 'Make your wand',
  sheetTitle: 'Parts of the wand',
  pictureFallback: 'wand',
}

export const wandShop: ShopView = {
  item: wandItem,
  path: '/wands',
  shop: 'wands',
  copy: wandCopy,
  Scene: Counter,
  groups: visibleGroups,
  widget: wandWidget,
  paintCard: paintWandCard,
  closeUp: { flashDelaySeconds: WAVE_TO_SPELL_SECONDS },
}
