import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { BoidsPage } from './pages/BoidsPage.tsx'

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: BoidsPage,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
