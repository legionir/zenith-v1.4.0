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
  type SSRHeadInput,
  type SSRI18nInput,
  type HeadManager,
  type SSRAdapterOptions,
  type SSRResult,
  type StreamChunk,
  type StreamOptions,
} from './render';

// FEATURE (v1.0.0) + #92: AsyncLocalStorage & Edge-compatible DOM/Request isolation.
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

// FEATURE (v0.4.0): Server Components — رندر کامل در سرور، بدون
// client JS برای آن زیردرخت. این مزیت بزرگ Zenith نسبت به React است
// چون HTML-First بودن به‌طور ذاتی از این الگو پشتیبانی می‌کند.
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
 * @default { includeHydrationData: true, timeout: 10000 }
 * @unit ms (timeout)
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  includeHydrationData: true,
  timeout: 10_000,
});

