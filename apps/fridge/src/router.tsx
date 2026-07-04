import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { SharedBoardRoute } from './features/share/SharedBoardRoute.tsx'
import { FridgePage } from './pages/FridgePage.tsx'

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: FridgePage,
})

// Opening a shared link imports the board and redirects to '/' (ADR 0010).
const sharedBoardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/b/$id',
  component: SharedBoardRoute,
})

const routeTree = rootRoute.addChildren([indexRoute, sharedBoardRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
