import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { ShelfPage } from './shelf/ShelfPage.tsx'
import { ShopPage } from './shop/ShopPage.tsx'
import { wandShop } from './shop/wandShop.ts'
import { smithy } from './smithy/smithy.ts'

const rootRoute = createRootRoute({ component: Outlet })

const shopRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <ShopPage view={wandShop} />,
})
const smithyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/swords',
  component: () => <ShopPage view={smithy} />,
})
const shelfRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/shelf',
  component: ShelfPage,
})

const routeTree = rootRoute.addChildren([shopRoute, smithyRoute, shelfRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
