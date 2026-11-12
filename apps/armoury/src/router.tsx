import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import { landingPath, type Landing } from './landing.ts'
import { SHARED_PATH, type SharedItem } from './share/shareLink.ts'
import { ShelfPage } from './shelf/ShelfPage.tsx'
import { ShopPage } from './shop/ShopPage.tsx'
import { wandShop } from './shop/wandShop.ts'
import { smithy } from './smithy/smithy.ts'
import { StreetPage } from './street/StreetPage.tsx'
import { PlayerView, SharedView } from './views.tsx'

/** What the page was opened with, read once before the router mounts. */
export interface Arrival {
  /** The item a share link brought, if the visit began with one. */
  shared: SharedItem | null
  landing: Landing
}

const rootRoute = createRootRouteWithContext<Arrival>()({
  component: Outlet,
  notFoundComponent: () => <Navigate to="/street" replace />,
})

// Pathless: the street, both shops and the shelf share one workbench over the player's storage.
const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'player',
  component: PlayerView,
})
// No `hash` on the redirect, so it drops a share link's fragment along with the root.
const indexRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    redirect({ to: landingPath(context.landing), replace: true, throw: true })
  },
})
const streetRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/street',
  component: StreetPage,
})
const wandsRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/wands',
  component: () => <ShopPage view={wandShop} />,
})
const swordsRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/swords',
  component: () => <ShopPage view={smithy} />,
})
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
// The gate leaves every path under /shared open, so none of them may fall through to the street.
const sharedBelowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: `${SHARED_PATH}/$`,
  component: SharedView,
})

const routeTree = rootRoute.addChildren([
  playerRoute.addChildren([indexRoute, streetRoute, wandsRoute, swordsRoute, shelfRoute]),
  sharedRoute,
  sharedBelowRoute,
])

export const router = createRouter({
  routeTree,
  context: { shared: null, landing: { arrivalKind: null, lastShop: null } },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
