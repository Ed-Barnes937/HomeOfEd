import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { ShelfPage } from './shelf/ShelfPage.tsx'
import { ShopPage } from './shop/ShopPage.tsx'

const rootRoute = createRootRoute({ component: Outlet })

const shopRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: ShopPage })
const shelfRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/shelf',
  component: ShelfPage,
})

const routeTree = rootRoute.addChildren([shopRoute, shelfRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
