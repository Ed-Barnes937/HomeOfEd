// The account screens' own .iwft fixture: the same harness as the home page's,
// with the account POM as the root.
import { createIwftTest } from '@hoe/test-kit'

import { AccountPagePom } from './AccountPagePom.ts'
import { IwftApp } from './IwftApp.tsx'

export const test = createIwftTest({
  harness: <IwftApp />,
  createRoot: (page) => new AccountPagePom(page),
})
