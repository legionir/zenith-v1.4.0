// ── Re-exports برای راحتی کاربران ──

/**
 * Re-export State از Phase 1 برای راحتی کاربران.
 *
 * به جای:
 *   import { signal } from '@zenith/state';
 *   import { Zen } from '@zenith/runtime';
 * می‌توانند فقط:
 *   import { Zen, signal } from '@zenith/runtime';
 */
export { signal, effect, computed, batch } from '@zenith/state';

/**
 * Re-export Action Registry API.
 */
export {
  registerAction,
  unregisterAction,
  getAction,
  getActionMeta,
  hasAction,
  clearActions,
  listActions,
  getDefaultRegistry,
  ActionRegistry,
} from '@zenith/actions';
export type { ActionContext, ActionFn, ActionMetadata } from '@zenith/actions';

/**
 * Re-export Event Delegation API (برای کاربران پیشرفته).
 */
export { initEventDelegation, parseBinding } from '@zenith/events';

/**
 * Re-export Component API (فاز ۶).
 */
export {
  loadComponents,
  registerComponent,
  unregisterComponent,
  isComponent,
  clearComponents,
} from '@zenith/components';

/**
 * Re-export Scheduler API (فاز ۷).
 */
export {
  scheduleEffect,
  flushSync,
  hasPendingEffects,
  pendingEffectCount,
  pendingEffectsByPriority,
  type Priority,
} from '@zenith/scheduler';

/**
 * Re-export Router API (فاز ۸).
 */
export {
  routeSignal,
  navigate,
  matchRoute,
  findMatchingRoute,
  setRouteParams,
  type RouteState,
} from '@zenith/router';

/**
 * Re-export Data Fetching API (فاز ۸).
 */
export { processFetch, type FetchState } from '@zenith/data';

/**
 * Re-export Security API (فاز ۹).
 */
export {
  sanitizeHTML,
  sanitizeHTMLWithOptions,
  sanitizeHTMLTrusted,
  type SanitizeOptions,
} from '@zenith/security';

/**
 * FEATURE (v0.4.0): Re-export zen-html-trusted directive processor.
 *
 * `processHtmlTrusted` مثل `processHtml` است اما به‌جای sanitizeHTML از
 * sanitizeHTMLTrusted (Identity function + dev warn) استفاده می‌کند. این
 * خروجی مستقیم برای کاربران پیشرفته‌ای است که می‌خواهند بدون walker از این
 * دایرکتیو استفاده کنند (مثلاً در pluginها یا manual DOM processing).
 *
 * کاربرد:
 *   import { processHtmlTrusted } from '@zenith/runtime';
 *   const dispose = processHtmlTrusted(el, expr, context);
 */
/** @public */
export { processHtmlTrusted } from './directives/html-trusted';

/**
 * FEATURE (v0.5.0): Re-export چهار دایرکتیو جدید runtime.
 *
 * این توابع برای کاربران پیشرفته‌ای مفید است که می‌خواهند بدون walker از
 * این دایرکتیوها استفاده کنند (مثلاً در pluginها یا manual DOM processing).
 *
 * کاربرد:
 *   import { processPortal, processIntersection, processCloak, processRef } from '@zenith/runtime';
 *   const dispose = processPortal(el, 'body', context);
 *
 *  - processPortal:       عنصر را به یک container دیگر منتقل می‌کند.
 *  - processIntersection: callback را وقتی عنصر وارد viewport شد اجرا می‌کند.
 *  - processCloak:        attribute zen-cloak را حذف می‌کند (ضد FOUC).
 *  - processRef:          عنصر DOM را در یک Signal در state ذخیره می‌کند.
 */
/** @public */
export { processPortal } from './directives/portal';
/** @public */
export { processIntersection } from './directives/intersection';
/** @public */
export { processCloak } from './directives/cloak';
/** @public */
export { processRef } from './directives/ref';
// #145 — zen-persist (ذخیرهٔ مقدار zen-model در @zenith/storage).
/** @public */
export { processPersist } from './directives/persist';

/**
 * FEATURE (v1.2.0): Re-export v1.2.x directive processors — restored in v1.2.2.
 *
 * These functions are useful for advanced users who want to apply the
 * directives without going through the walker (e.g. in plugins or manual
 * DOM processing).
 *
 *  - processMemo:           memoize subtree processing by expression value.
 *  - processIsland:         defer child processing (visible/idle/load).
 *  - processVirtualRepeat:  virtual scrolling for large lists.
 *  - processStatefulButton: stateful button with idle/loading/success/error.
 *  - processOptimistic:     optimistic update with rollback on failure.
 *  - processTrack:          analytics tracking (click / visible).
 *  - processDatePicker:     Persian (Jalali) date picker web component.
 */
/** @public */
export { processMemo } from './directives/memo';
/** @public */
export { processIsland } from './directives/island';
/** @public */
export { processVirtualRepeat } from './directives/virtual-repeat';
/** @public */
export { processStatefulButton } from './directives/stateful-button';
/** @public */
export { processOptimistic } from './directives/optimistic';
export { processTrack, configureAnalytics, setAnalyticsConsent, type LegacyAnalyticsOptions } from './directives/track';
export { processDatePicker } from './directives/date-picker';

/**
 * #88: lazy heavy directives — date-picker and virtual-repeat leave the
 * eager entry and load on first discovery (separate bundler chunks).
 * The eager `processDatePicker`/`processVirtualRepeat` exports above stay
 * for direct consumers; the walker prefers the lazy path.
 */
export {
  registerLazyDirective,
  unregisterLazyDirective,
  listLazyDirectives,
  ensureLazyProcessor,
  getLoadedProcessor,
  preloadLazyDirectives,
  lazyDirectiveManifest,
  processLazyDirective,
  isLazyBound,
  type LazyDirectiveSpec,
  type LazyDirectiveMatch,
  type LazyDirectiveLoader,
  type LazyDirectiveInvoke,
  type LazyDirectiveManifestEntry,
} from './directives/lazy';

/**
 * FEATURE (v1.2.0): Re-export the Hydration Engine API — restored in v1.2.2.
 *
 * The Hydration Engine attaches reactive effects to existing SSR-rendered
 * DOM nodes without rebuilding them, eliminating the flicker that comes
 * from innerHTML rewrites during hydration.
 */
export {
  createHydrator,
  hydrateText,
  hydrateTextExpr,
  hydrateHtml,
  hydrateHtmlExpr,
  hydrateHtmlTrusted,
  hydrateShow,
  hydrateShowExpr,
  hydrateIf,
  hydrateBind,
  hydrateBindExpr,
  hydrateModel,
  hasHydrationMarkers,
  countHydrationMarkers,
  type Hydrator,
} from './hydrate';

/**
 * Re-export DevTools API (فاز ۱۰).
 */
export {
  initDevTools,
  cleanupDevtools,
  isDevtoolsHookInstalled,
  getDevtoolsVersion,
  type ZenithDevtoolsHook,
} from '@zenith/devtools';

/**
 * Re-export Error Boundary API (فاز ۱۱).
 */
export {
  errorSignal,
  onError,
  reportError,
  clearError,
  clearErrorBoundary,
  processErrorBoundary,
  showFallback,
  recoverFromError,
  type ZenithError,
} from '@zenith/error-boundary';

/**
 * Re-export Context API (برای dependency injection).
 * @public
 */
export { setRouteSignalProvider } from './context';

/**
 * FEATURE (v0.6.0): Re-export Custom Directive Registry API از walker.
 *
 * این API به پلاگین‌ها (مثل @zenith/stateful) اجازه می‌دهد تا handlerهای
 * خود را برای تگ‌های سفارشی مثل <zen-resource-view> ثبت کنند. walker هنگام
 * پیمایش، اگر به تگ ثبت‌شده‌ای برسد، handler آن را فراخوانی می‌کند.
 *
 * کاربرد:
 *   import { registerCustomDirective } from '@zenith/runtime';
 *   registerCustomDirective('zen-resource-view', { handler: processResourceView, attributeName: 'config' });
 *
 * نکته: برای راه‌اندازی خودکار، می‌توان از `Zen.use(plugin)` استفاده کرد.
 */
export {
  registerCustomDirective,
  unregisterCustomDirective,
  clearCustomDirectives,
  getCustomDirective,
  hasCustomDirective,
  listCustomDirectives,
  type CustomDirectiveHandler,
  type CustomDirectiveOptions,
} from './walker';

/**
 * FEATURE (v0.4.0): Re-export Walker API سطح پایین.
 *
 * `walkAndBind` یک نسخه‌ی سبک‌وزنِ processDOM است که برای per-clone binding
 * در zen-for کامپایل‌شده استفاده می‌شود. برخلاف `Zen.start`، این تابع:
 *   - Event Delegation را re-init نمی‌کند.
 *   - resetResourceRegistry صدا نمی‌زند.
 *   - یک تابع teardown برمی‌گرداند که Effectهای ایجادشده را dispose می‌کند.
 *
 * مورد استفاده‌ی اصلی: vite-plugin `processChildren` برای zen-for کامپایل‌شده.
 */
export { walkAndBind } from './walker';

/**
 * FEATURE (v1.0.0): Re-export HTML attribute types.
 *
 * این types برای کاربران TypeScript طراحی شده‌اند تا بتوانند zen-*
 * attribute ها را در پروژه‌های خود به‌صورت type-safe استفاده کنند.
 *
 * @example
 *   import type { ZenithAttributes, AllZenithAttributes } from '@zenith/runtime';
 *
 *   // برای extend کردن یک element:
 *   function MyComponent(props: ZenithAttributes & { children?: React.ReactNode }) {
 *     return <div {...props} />;
 *   }
 * @public
 */
export {
  type ZenithAttributes,
  type ZenBindAttribute,
  type AllZenithAttributes,
} from './attributes';

/**
 * FEATURE (v1.4.0): Re-export Runtime Parity Checker API.
 *
 * These utilities warn when runtime behavior diverges from compiled output.
 */
export {
  setStrictParity,
  isStrictParityEnabled,
  reportParityDivergence,
  assertParity,
  clearParityWarnings,
  type ParityDivergenceOptions,
  type ParityAssertionOptions,
} from './parity-check';

/**
 * FEATURE (v1.4.0): Re-export Auth API.
 */
export {
  auth,
  configureAuth,
  initAuth,
  login,
  logout,
  register,
  refreshToken,
  fetchCurrentUser,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasPermission,
  hasAnyPermission,
  canActivateRoute,
  type User,
  type AuthTokens,
  type FunctionalAuthState,
  type LoginCredentials,
  type RegisterData,
  type FunctionalAuthConfig,
  type RouteGuard,
} from './auth-api';

/**
 * #148 (SPEC §۲.۸): بازصادرات API مدل createApp از `@zenith/runtime-core`.
 */
export {
  createApp,
  defaultApp,
  resetDefaultAppForTesting,
  defineDirective,
  definePlugin,
  onMount,
  onUnmount,
  onUpdate,
  provide,
  inject,
  createInjectionKey,
  useApp,
  assertCompatible,
  hydrate,
  startFromSSR,
  createFocusTrap,
  createRovingTabindex,
  lockScroll,
  useId,
  computePosition,
  appOptions,
  APP_OPTIONS_DEFAULTS,
  appOptionsSchema,
  resolveAppOptions,
  type App,
  type AppOptions,
  type ResolvedAppOptions,
  type DirectiveDefinition,
  type BindContext,
  type SsrContext,
  type Plugin as RuntimeCorePlugin,
  type HydrationResult,
  type HydrationMismatch,
  type InjectionKey,
} from '@zenith/runtime-core';

export { setActionRegistryStore } from '@zenith/actions';
export { setComponentRegistryStore } from '@zenith/components';

export {
  createAnalytics,
  consoleProvider,
  beaconProvider,
  gtagProvider,
  plausibleProvider,
  type AnalyticsEvent,
  type AnalyticsProvider,
  type AnalyticsOptions,
  type AnalyticsInstance,
} from './directives/track';
