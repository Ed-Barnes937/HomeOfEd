import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('the landing page shows a back-to-hub link pointing at home of ed', async ({
  mountApp,
  page,
}) => {
  await mountApp()
  const back = page.getByRole('link', { name: /back to home of ed/i })
  await expect(back).toHaveAttribute('href', 'http://localhost:3000')
})
