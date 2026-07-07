import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { ChatContinuePage } from './pages/ChatContinuePage.tsx'
import { ChatNewPage } from './pages/ChatNewPage.tsx'
import { ChildHomePage } from './pages/ChildHomePage.tsx'
import { ChildLoginPage } from './pages/ChildLoginPage.tsx'
import { ChildrenListPage } from './pages/ChildrenListPage.tsx'
import { ChildSettingsPage } from './pages/ChildSettingsPage.tsx'
import { ConversationDetailPage } from './pages/ConversationDetailPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { FlagsPage } from './pages/FlagsPage.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { OnboardingPage } from './pages/OnboardingPage.tsx'
import { ParentLoginPage } from './pages/ParentLoginPage.tsx'
import { ParentRegisterPage } from './pages/ParentRegisterPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'

// Explicit per-route `createRoute` calls (not a helper) so TanStack Router
// infers the typed route tree — the typed `Link`/`useParams`/`getRouteApi`
// surface depends on that inference.
const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage })

const parentLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parent/login',
  component: ParentLoginPage,
})
const parentRegisterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parent/register',
  component: ParentRegisterPage,
})
const parentDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parent/dashboard',
  component: DashboardPage,
})
const parentOnboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parent/onboarding',
  component: OnboardingPage,
})
const parentChildrenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parent/children',
  component: ChildrenListPage,
})
const parentChildSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parent/children/$childId',
  component: ChildSettingsPage,
})
const parentConversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parent/conversations/$conversationId',
  component: ConversationDetailPage,
})
const parentFlagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parent/flags',
  component: FlagsPage,
})
const parentSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parent/settings',
  component: SettingsPage,
})

const childLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/child/login',
  component: ChildLoginPage,
})
const childHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/child/home',
  component: ChildHomePage,
})
const childChatNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/child/chat/new',
  component: ChatNewPage,
})
const childChatContinueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/child/chat/$conversationId',
  component: ChatContinuePage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  parentLoginRoute,
  parentRegisterRoute,
  parentDashboardRoute,
  parentOnboardingRoute,
  parentChildrenRoute,
  parentChildSettingsRoute,
  parentConversationRoute,
  parentFlagsRoute,
  parentSettingsRoute,
  childLoginRoute,
  childHomeRoute,
  childChatNewRoute,
  childChatContinueRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
