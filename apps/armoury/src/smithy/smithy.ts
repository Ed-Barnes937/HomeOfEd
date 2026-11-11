import { paintSmithyCard } from '../share/smithyCard.ts'
import type { ShopCopy, ShopView } from '../shop/shopView.ts'
import { swordItem } from '../sword/item.ts'
import { Anvil } from './Anvil.tsx'
import { visibleGroups } from './swordGroups.ts'
import { swordWidget } from './swordWidgets.tsx'

export const smithyCopy: ShopCopy = {
  motto: 'swords made to measure',
  sceneButton: 'Pick the sword up',
  sceneHint: 'Tap the sword to see it shine',
  closeLookTitle: 'Your sword, up close',
  closeLookAction: 'Make it shine',
  closeLookHint: 'Drag to turn it. Tap it to make it shine.',
  keep: 'Keep this sword',
  kept: (name) => `${name} is on your shelf.`,
  nameField: 'Sword name',
  share: 'Share a link to this sword',
  shareTitle: 'Armoury',
  shareText: 'Look at the sword I made',
  picture: 'Save a picture of this sword',
  shelfLink: (count) => `Your shelf, ${count} swords`,
  panelTitle: 'Make your sword',
  sheetTitle: 'Parts of the sword',
  pictureFallback: 'sword',
}

export const smithy: ShopView = {
  item: swordItem,
  path: '/swords',
  shop: 'smithy',
  copy: smithyCopy,
  Scene: Anvil,
  groups: visibleGroups,
  widget: swordWidget,
  paintCard: paintSmithyCard,
  closeUp: { flashDelaySeconds: null },
}
