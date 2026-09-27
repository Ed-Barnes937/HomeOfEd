// page.route stand-in for Better Auth's `/api/auth/*` (the sanctioned fallback:
// the trampoline only serves tRPC). Sign-in sets a cookie naming the parent;
// IwftApp's auth seam reads it, so identity can change mid-test like prod.
import type { Page } from '@playwright/test'

export const IWFT_PARENT_COOKIE = 'iwft_parent'

export interface ParentAccount {
  id: string
  email: string
  password: string
}

export async function installParentAuthRoute(page: Page, account: ParentAccount): Promise<void> {
  await page.route('**/api/auth/sign-in/email', async (route) => {
    const body = route.request().postDataJSON() as { email?: string; password?: string }
    if (body.email !== account.email || body.password !== account.password) {
      return route.fulfill({ status: 401, json: { message: 'Invalid email or password.' } })
    }
    await page.context().addCookies([
      { name: IWFT_PARENT_COOKIE, value: account.id, url: new URL(page.url()).origin },
    ])
    return route.fulfill({ status: 200, json: {} })
  })
  await page.route('**/api/auth/sign-out', async (route) => {
    await page.context().clearCookies({ name: IWFT_PARENT_COOKIE })
    return route.fulfill({ status: 200, json: {} })
  })
}
