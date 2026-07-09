import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { KaresansuiPage } from './pages/KaresansuiPage.tsx'

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: KaresansuiPage,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
