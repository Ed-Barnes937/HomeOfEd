// armoury's .iwft fixture: registers the harness element and root POM with test-kit.
import { createIwftTest } from '@hoe/test-kit'

import { ApothecaryPom } from './ApothecaryPom.ts'
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

export const failedStageTest = createIwftTest({
  harness: <IwftApp start="wand" stagesFail />,
  createRoot: (page) => new ShopPom(page),
})

export const failedSmithyStageTest = createIwftTest({
  harness: <IwftApp start="sword" stagesFail />,
  createRoot: (page) => new SmithyPom(page),
})

export const apothecaryTest = createIwftTest({
  harness: <IwftApp start="potion" />,
  createRoot: (page) => new ApothecaryPom(page),
})

export const failedApothecaryStageTest = createIwftTest({
  harness: <IwftApp start="potion" stagesFail />,
  createRoot: (page) => new ApothecaryPom(page),
})
