// packages/router/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/router`.
//
// استفاده در runtime:
//   import { processRouter, routeSignal, navigate } from '@zenith/router';
//
// استفاده در تست‌ها یا کاربران پیشرفته:
//   import { matchRoute, findMatchingRoute } from '@zenith/router';

export {
  routeSignal,
  matchRoute,
  findMatchingRoute,
  navigate,
  setRouteParams,
  installPopstateListener,
  cleanupRouter,
  runWithRoute,
  runWithRouteSync,
  registerRouterCleanup,
  beforeEach,
  defineRoutes,
  useRoute,
  type RouteState,
  type NavigationGuard,
  type NavigateOptions,
  type Route,
  type RouteContext,
} from './router';

export { processRouter, prefetchRoute, clearRouteCache } from './outlet';
