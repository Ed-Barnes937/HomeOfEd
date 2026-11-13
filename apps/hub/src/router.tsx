import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { AccountPage } from './pages/account/AccountPage.tsx'
import { HomePage } from './pages/HomePage.tsx'

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: AccountPage,
})

// A child of /account, so the page (and any silent renewal) stays mounted between the two.
const accountSettingsRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: 'settings',
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  accountRoute.addChildren([accountSettingsRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
