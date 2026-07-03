// boids's .iwft fixture: registers the app-specifics (harness element + root
// POM) with test-kit's factory. The <IwftApp /> element is created HERE, in
// app code, so Playwright CT registers the component for the browser bundle.
import { createIwftTest } from '@hoe/test-kit'

import { BoidsPagePom } from './BoidsPagePom.ts'
import { IwftApp } from './IwftApp.tsx'

export const test = createIwftTest({
  harness: <IwftApp />,
  createRoot: (page) => new BoidsPagePom(page),
})
