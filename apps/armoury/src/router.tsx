import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import { landingPath, type Landing } from './landing.ts'
import { ShelfPage } from './shelf/ShelfPage.tsx'
import { ShopPage } from './shop/ShopPage.tsx'
import { wandShop } from './shop/wandShop.ts'
import { smithy } from './smithy/smithy.ts'
import { StreetPage } from './street/StreetPage.tsx'

const rootRoute = createRootRouteWithContext<{ landing: Landing }>()({
  component: Outlet,
  notFoundComponent: () => <Navigate to="/street" replace />,
})

// No `hash` on the redirect, so it drops a share link's fragment along with the root.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    redirect({ to: landingPath(context.landing), replace: true, throw: true })
  },
})
const streetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/street',
  component: StreetPage,
})
const wandsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wands',
  component: () => <ShopPage view={wandShop} />,
})
const swordsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/swords',
  component: () => <ShopPage view={smithy} />,
})
const shelfRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/shelf',
  component: ShelfPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  streetRoute,
  wandsRoute,
  swordsRoute,
  shelfRoute,
])

export const router = createRouter({
  routeTree,
  context: { landing: { arrivalKind: null, lastShop: null } },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
