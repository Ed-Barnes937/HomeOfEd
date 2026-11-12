import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { KeepSharedBoardRoute, SharedBoardRoute } from './features/share/SharedBoardRoute.tsx'
import { FridgePage } from './pages/FridgePage.tsx'
import { PlayerLayout } from './pages/PlayerLayout.tsx'

const rootRoute = createRootRoute({ component: Outlet })

// The player's own fridge, behind the gate (ADR 0093/0094).
const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_player',
  component: PlayerLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/',
  component: FridgePage,
})

// Keeping a shared fridge imports it and redirects to '/' (ADR 0010).
const keepRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/keep/$id',
  component: KeepSharedBoardRoute,
})

// A shared link opens the board to play with, public and keeping nothing (ADR 0093).
const sharedBoardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/b/$id',
  component: SharedBoardRoute,
})

const routeTree = rootRoute.addChildren([
  playerRoute.addChildren([indexRoute, keepRoute]),
  sharedBoardRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
