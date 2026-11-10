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

const routeTree = rootRoute.addChildren([indexRoute, accountRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
