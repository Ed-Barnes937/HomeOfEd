import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { PlayerView, SharedView } from './pages/views.tsx'
import { SHARED_PATH } from './share/shareLink.ts'

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlayerView,
})

const sharedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: SHARED_PATH,
  component: SharedView,
})

const routeTree = rootRoute.addChildren([indexRoute, sharedRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
