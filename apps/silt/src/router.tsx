import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { PlayerView } from './pages/PlayerView.tsx'

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlayerView,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
