/** @public */
export type { SSRDocument, SSRDOMWindow, SSRDOMInstance } from './dom-types';
/** @public */
export {
  renderToString,
  renderToStream,
  renderToReadableStream,
  clearSSRTemplateCache,
  getSSRTemplateCacheStats,
  generateHydrationScript,
  generateFullPage,
  renderSSRHead,
  createHead,
  useHead,
  renderHead,
  titleFromRoute,
  createNodeHandler,
  createFetchHandler,
  createCloudflareHandler,
  createDenoHandler,
  serializeState,
  injectState,
  validateHydration,
  validateHydrationChecksum,
  calculateChecksum,
  getEnvironment,
  isServer,
  isClient,
  runOnServer,
  runOnClient,
  type RenderOptions,
  type SSRAppContext,
  type SSRHeadInput,
  type SSRI18nInput,
  type HeadManager,
  type SSRAdapterOptions,
  type SSRResult,
  type StreamChunk,
  type StreamOptions,
  type StreamMetadata,
} from './render';

// FEATURE (v1.0.0) + #92: AsyncLocalStorage & Edge-compatible DOM/Request isolation.
// #56: canonical home is `@zenith/ssr/internal`; these root names are
// compatibility bridges (real origin: @internal) kept until removal is approved (2.0).
export {
  domAls,
  getDOMGlobals,
  installDOMGlobalGetters,
  isAsyncLocalStorageAvailable,
  createAsyncContextStore,
  getSSRRuntimeEnv,
  type AsyncContextStore,
  type DOMGlobals,
} from './dom-context';

/** @public */
export {
  hydrate,
  startFromSSR,
  deserializeState,
  deserializeStateFromString,
  loadPreloadedState,
  isHydrationMode,
  clearHydrationData,
  type HydrationResult,
} from './hydrate';

// #163: Static Site Generation (SSG) — prerender اعلانی مسیرها + sitemap/robots.
// هسته fs-free است؛ نوشتن فایل‌ها در `cli/src/ssg.ts` انجام می‌شود.
/** @public */
export {
  defineStaticRoutes,
  prerender,
  generateSitemapXml,
  generateRobotsTxt,
  type StaticRouteDef,
  type RouterLikeRoute,
  type PrerenderOptions,
  type PrerenderArtifacts,
  type PrerenderReport,
} from './ssg';

// FEATURE (v0.4.0): Server Components — رندر کامل در سرور، بدون
// client JS برای آن زیردرخت. این مزیت بزرگ Zenith نسبت به React است
// چون HTML-First بودن به‌طور ذاتی از این الگو پشتیبانی می‌کند.
/** @public */
export {
  defineServerComponent,
  registerServerComponent,
  getServerComponent,
  hasServerComponent,
  listServerComponents,
  unregisterServerComponent,
  clearServerComponents,
  renderServerComponent,
  inlineServerComponents,
  makeOpenMarker,
  makeCloseMarker,
  SERVER_COMPONENT_OPEN_PREFIX,
  SERVER_COMPONENT_CLOSE_PREFIX,
  type ServerComponent,
} from './server-component';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/ssr` (`RenderOptions` / `StreamOptions`).
 * @public
 * @default { includeHydrationData: true, timeout: 10000 }
 * @unit ms (timeout)
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  includeHydrationData: true,
  timeout: 10_000,
});

/** @public */
export { cloneRequestState, type RequestStateOptions } from './request-state';
