// armoury's .iwft fixture: registers the harness element and root POM with test-kit.
import { createIwftTest } from '@hoe/test-kit'

import { IwftApp } from './IwftApp.tsx'
import { ShopPom } from './ShopPom.ts'

export const test = createIwftTest({
  harness: <IwftApp />,
  createRoot: (page) => new ShopPom(page),
})
