// armoury's .iwft fixture: registers the harness element and root POM with test-kit.
import { createIwftTest } from '@hoe/test-kit'

import { IwftApp } from './IwftApp.tsx'
import { ShopPom } from './ShopPom.ts'
import { SmithyPom } from './SmithyPom.ts'
import { StreetPom } from './StreetPom.ts'

export const test = createIwftTest({
  harness: <IwftApp start="wand" />,
  createRoot: (page) => new ShopPom(page),
})

export const smithyTest = createIwftTest({
  harness: <IwftApp start="sword" />,
  createRoot: (page) => new SmithyPom(page),
})

export const streetTest = createIwftTest({
  harness: <IwftApp />,
  createRoot: (page) => new StreetPom(page),
})
