import { routeTrpcToPage } from '@hoe/test-kit'
import { test } from '@playwright/experimental-ct-react'

import { HomePagePom } from './testing/HomePagePom.ts'
import { IwftApp } from './testing/IwftApp.tsx'

test('home page renders the health value served by the in-browser backend', async ({
  mount,
  page,
}) => {
  await routeTrpcToPage(page)
  await mount(<IwftApp />)
  const home = new HomePagePom(page)
  await home.verifyIsShown()
  await home.verifyHealthValue('hello from pglite')
})
