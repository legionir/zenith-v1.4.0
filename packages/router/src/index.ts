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
  afterEach,
  setScrollBehavior,
  installRouteAnnouncer,
  defineRoutes,
  useRoute,
  announceRouteChange,
  syncActiveRouteLinks,
  type RouteState,
  type NavigationGuard,
  type NavigationAfterHook,
  type ScrollPosition,
  type ScrollBehaviorFn,
  type RouteAnnouncerOptions,
  type NavigateOptions,
  type Route,
  type RouteContext,
} from './router';

export { processRouter, prefetchRoute, clearRouteCache } from './outlet';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/router` (`NavigateOptions`).
 * @default { mode: 'hash', replace: false }
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  mode: 'hash' as const,
  replace: false,
});
