import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { SHARED_PATH } from './share/shareLink.ts'
import { ShelfPage } from './shelf/ShelfPage.tsx'
import { ShopPage } from './shop/ShopPage.tsx'
import { PlayerView, SharedView } from './views.tsx'

const rootRoute = createRootRoute({ component: Outlet })

// Pathless: the counter and the shelf share one workbench over the player's storage.
const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'player',
  component: PlayerView,
})
const shopRoute = createRoute({ getParentRoute: () => playerRoute, path: '/', component: ShopPage })
const shelfRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/shelf',
  component: ShelfPage,
})

const sharedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: SHARED_PATH,
  component: SharedView,
})

const routeTree = rootRoute.addChildren([
  playerRoute.addChildren([shopRoute, shelfRoute]),
  sharedRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
