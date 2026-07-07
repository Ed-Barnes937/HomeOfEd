// sprout's .iwft fixture: registers the harness element + root POM with
// test-kit's factory. The <IwftApp /> element is created HERE (app code) so
// Playwright CT registers the component for the browser bundle.
import { createIwftTest } from '@hoe/test-kit'

import { IwftApp } from './IwftApp.tsx'
import { SproutAppPom } from './SproutAppPom.ts'

export const test = createIwftTest({
  harness: <IwftApp />,
  createRoot: (page) => new SproutAppPom(page),
})
