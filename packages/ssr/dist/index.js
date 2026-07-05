export { renderToString, renderToStream, generateHydrationScript, generateFullPage, } from './render.js';
// FEATURE (v1.0.0): AsyncLocalStorage-based DOM globals isolation.
// این ماژول race condition در SSR concurrent را با ذخیره‌ی DOM globals
// در یک AsyncLocalStorage store به‌ازای هر درخواست برطرف می‌کند.
// globalThis دیگر mutate نمی‌شود — به‌جای آن، getters نصب می‌شوند که از
// store فعلی می‌خوانند. این exportها برای کاربران پیشرفته‌ای است که
// می‌خواهند به‌صورت دستی store را مدیریت کنند (مثلاً در test helpers).
export { domAls, getDOMGlobals, installDOMGlobalGetters, } from './dom-context.js';
export { hydrate, startFromSSR, deserializeState, isHydrationMode, clearHydrationData, } from './hydrate.js';
// FEATURE (v0.4.0): Server Components — رندر کامل در سرور، بدون
// client JS برای آن زیردرخت. این مزیت بزرگ Zenith نسبت به React است
// چون HTML-First بودن به‌طور ذاتی از این الگو پشتیبانی می‌کند.
export {
  defineServerComponent,
  registerServerComponent,
  getServerComponent,
  unregisterServerComponent,
  clearServerComponents,
  renderServerComponent,
  inlineServerComponents,
  makeOpenMarker,
  makeCloseMarker,
  SERVER_COMPONENT_OPEN_PREFIX,
  SERVER_COMPONENT_CLOSE_PREFIX,
} from './server-component.js';
//# sourceMappingURL=index.js.map
