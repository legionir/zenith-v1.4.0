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

// #39/#87: runWithRoute* عمداً از ssr-route export می‌شوند تا زنجیرهٔ
// @zenith/logger فقط برای مصرف‌کنندگان SSR وارد bundle شود و ورودی سبک
// `navigate` بودجهٔ ≤4KB gzip خود را حفظ کند (sideEffects: ['./dist/index.js']).
export { runWithRoute, runWithRouteSync } from './ssr-route';

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
