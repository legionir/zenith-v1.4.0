// packages/errors/src/deprecation-codes.ts
//
// رجیستری رسمی هشدارهای deprecation — استخراج مکانیکی از core.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).


/**
 * رجیستری رسمی هشدارهای deprecation (DEC-019؛ سیاست #58؛ حذف در ۲.۰ طبق DEC-026).
 * `deprecate()` همین کدها را مصرف می‌کند؛ ثبت‌کردنشان در errors یعنی #171
 * فضای `ZEN-DEPR-xxx` را رسمی کرده است.
 */
/** @public */
export const DEPRECATION_CODES: Readonly<
  Record<string, { api: string; replacement: string; removedIn: string }>
> = {
  'ZEN-DEPR-072': { api: 'getCachedData(url, ttl)', replacement: 'getCachedData(url, { ttl })', removedIn: '2.0.0' },
  'ZEN-DEPR-073': { api: 'setCachedData(url, data, tags)', replacement: 'setCachedData(url, data, { tags })', removedIn: '2.0.0' },
  'ZEN-DEPR-074': { api: 'formatLocaleNumber(value, locale, options)', replacement: 'formatLocaleNumber(value, { locale, intl })', removedIn: '2.0.0' },
  'ZEN-DEPR-075': { api: 'formatCurrency(value, locale, currency, options)', replacement: 'formatCurrency(value, { locale, currency, intl })', removedIn: '2.0.0' },
  'ZEN-DEPR-076': { api: 'formatRelativeTime(value, unit, locale, options)', replacement: 'formatRelativeTime(value, unit, { locale, intl })', removedIn: '2.0.0' },
  'ZEN-DEPR-077': { api: 'formatDateTime(value, locale, options)', replacement: 'formatDateTime(value, { locale, intl })', removedIn: '2.0.0' },
  'ZEN-DEPR-078': { api: 'formatList(value, locale, options)', replacement: 'formatList(value, { locale, intl })', removedIn: '2.0.0' },
  'ZEN-DEPR-079': { api: 'cacheFirst(request, cacheName)', replacement: 'cacheFirst(request, { cacheName })', removedIn: '2.0.0' },
  'ZEN-DEPR-080': { api: 'networkFirst(request, cacheName, timeout)', replacement: 'networkFirst(request, { cacheName, timeout })', removedIn: '2.0.0' },
  'ZEN-DEPR-081': { api: 'cacheThenNetwork(request, cacheName, onUpdate)', replacement: 'cacheThenNetwork(request, { cacheName, onUpdate })', removedIn: '2.0.0' },
  'ZEN-DEPR-082': { api: 'applyStrategy(name, request, cacheName, timeout)', replacement: 'applyStrategy(name, request, { cacheName, timeout })', removedIn: '2.0.0' },
  'ZEN-DEPR-083': { api: 'staleWhileRevalidate(request, cacheName)', replacement: 'staleWhileRevalidate(request, { cacheName })', removedIn: '2.0.0' },
  'ZEN-DEPR-084': { api: 'cacheOnly(request, cacheName)', replacement: 'cacheOnly(request, { cacheName })', removedIn: '2.0.0' },
  'ZEN-DEPR-085': { api: 'zenAnimate(el, keyframes, options)', replacement: 'zenAnimate(el, { keyframes, ...options })', removedIn: '2.0.0' },
  'ZEN-DEPR-086': { api: 'registerCustomDirective(tag, handler, attribute)', replacement: 'registerCustomDirective(tag, { handler, attributeName })', removedIn: '2.0.0' },
  'ZEN-DEPR-087': { api: 'reportParityDivergence(directive, description, hint)', replacement: 'reportParityDivergence(directive, { description, hint })', removedIn: '2.0.0' },
  'ZEN-DEPR-095': { api: 'validateField(value, rules, allValues)', replacement: 'validateField(value, { rules, allValues })', removedIn: '2.0.0' },
  'ZEN-DEPR-096': { api: 'validateFieldAsync(value, rules, allValues, signal)', replacement: 'validateFieldAsync(value, { rules, allValues, signal })', removedIn: '2.0.0' },
  'ZEN-DEPR-097': { api: 'validateFormAsync(values, rules, signal)', replacement: 'validateFormAsync({ values, rules, signal })', removedIn: '2.0.0' },
  'ZEN-DEPR-098': { api: 'validateWithLifecycle(values, rules, lifecycle, async)', replacement: 'validateWithLifecycle(values, { rules, lifecycle, async })', removedIn: '2.0.0' },
  'ZEN-DEPR-099': { api: 'moveItem(fieldName, from, to)', replacement: 'moveItem(fieldName, { from, to })', removedIn: '2.0.0' },
  'ZEN-DEPR-101': { api: 'addSignal(id, name, value)', replacement: 'addSignal(id, { name, value })', removedIn: '2.0.0' },
  'ZEN-DEPR-104': { api: 'addStaticFor(id, expr, itemCount)', replacement: 'addStaticFor(id, { expr, itemCount })', removedIn: '2.0.0' },
  'ZEN-DEPR-105': { api: 'recordResourceDestroy(name, url, stack)', replacement: 'recordResourceDestroy(name, { url, stack })', removedIn: '2.0.0' },
  'ZEN-DEPR-103': { api: 'recordPanelStateChange(id, old, next, name)', replacement: 'recordPanelStateChange(id, { oldValue, newValue, signalName })', removedIn: '2.0.0' },
  'ZEN-DEPR-102': { api: 'addDirective(id, type, selector, expression)', replacement: 'addDirective(id, { directiveType, elementSelector, expression })', removedIn: '2.0.0' },
  'ZEN-DEPR-100': { api: 'addField(name, initial, rules)', replacement: 'addField({ name, initial, rules })', removedIn: '2.0.0' },
  'ZEN-DEPR-093': { api: 'render(template, state, options)', replacement: 'render({ template, state, attachToBody })', removedIn: '2.0.0' },
  'ZEN-DEPR-094': { api: 'testDirective(directive, html, state)', replacement: 'testDirective(directive, { html, state })', removedIn: '2.0.0' },
  'ZEN-DEPR-090': { api: 'runParityTest(suite, runtimeRunner, compilerRunner)', replacement: 'runParityTest(suite, { runtimeRunner, compilerRunner })', removedIn: '2.0.0' },
  'ZEN-DEPR-091': { api: 'runAllParityTests(runtimeRunner, compilerRunner)', replacement: 'runAllParityTests({ runtimeRunner, compilerRunner })', removedIn: '2.0.0' },
  'ZEN-DEPR-092': { api: 'setSafeInnerHTML(el, html, trusted)', replacement: 'setSafeInnerHTML(el, { html, trusted })', removedIn: '2.0.0' },
  'ZEN-DEPR-089': { api: 'setColumnFilter(key, value, operator)', replacement: 'setColumnFilter(key, { value, operator })', removedIn: '2.0.0' },
  'ZEN-DEPR-088': { api: 'assertParity(directive, runtime, expected, description)', replacement: 'assertParity(directive, { runtimeValue, expectedCompilerValue, description })', removedIn: '2.0.0' },
  'ZEN-DEPR-001': {
    api: 'processVirtualList',
    replacement: 'createVirtualList',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-002': {
    api: 'enterTransition',
    replacement: 'createTransition(name).enter(el)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-003': {
    api: 'leaveTransition',
    replacement: 'createTransition(name).leave(el)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-004': {
    api: 'animateGroup',
    replacement: 'createTransition(name) shared controller',
    removedIn: '2.0.0',
  },
  // #144 — نام یکتای clearHttpCache (رفع clearCache تکراری در http).
  'ZEN-DEPR-005': {
    api: 'clearCache (http)',
    replacement: 'clearHttpCache',
    removedIn: '2.0.0',
  },
  // #146 — توابع جلالی @zenith/i18n به @zenith/jalali منتقل شدند (SPEC §۲.۶
  // «مهاجرت: alias + deprecate»؛ حذف فقط در 2.0 طبق DEC-026).
  'ZEN-DEPR-006': {
    api: 'toJalali (i18n)',
    replacement: '@zenith/jalali toJalaliParts/formatJalali',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-007': {
    api: 'fromJalali (i18n)',
    replacement: '@zenith/jalali fromJalaliParts',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-008': {
    api: 'parseJalaliParts (i18n)',
    replacement: '@zenith/jalali toJalaliParts',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-009': {
    api: 'formatJalali (i18n)',
    replacement: '@zenith/jalali formatJalali',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-010': {
    api: 'jalaliNow (i18n)',
    replacement: '@zenith/jalali jalaliNow',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-011': {
    api: 'jalaliMonthDays (i18n)',
    replacement: '@zenith/jalali monthDays',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-012': {
    api: 'jalaliMonthName (i18n)',
    replacement: '@zenith/jalali monthName',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-013': {
    api: 'isJalaliLeap (i18n)',
    replacement: '@zenith/jalali isLeap',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-014': {
    api: 'compareJalali (i18n)',
    replacement: '@zenith/jalali compareJalali',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-015': {
    api: 'addDaysJalali (i18n)',
    replacement: '@zenith/jalali addDays',
    removedIn: '2.0.0',
  },
  // #142 — adapters ساخت schema در @zenith/form به @zenith/schema منتقل شدند
  // (SPEC §۲.۲ «مهاجرت: alias + deprecate»؛ منطق خالص در /zod و /json-schema).
  'ZEN-DEPR-016': {
    api: 'fromZod (form)',
    replacement: '@zenith/schema/zod fromZod',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-017': {
    api: 'validateWithZod (form)',
    replacement: '@zenith/schema/zod validateWithZod',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-018': {
    api: 'fromJsonSchema (form)',
    replacement: '@zenith/schema/json-schema fromJsonSchema',
    removedIn: '2.0.0',
  },
  // #116 — پروتکل یکسان cleanup: نام‌گذاری lifecycle به Disposable.dispose().
  'ZEN-DEPR-019': {
    api: 'ActionRegistry.destroy()',
    replacement: 'ActionRegistry.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-020': {
    api: 'Auth.destroy()',
    replacement: 'Auth.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-021': {
    api: 'CrudEngine.destroy()',
    replacement: 'CrudEngine.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-022': {
    api: 'FormStore.destroy()',
    replacement: 'FormStore.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-023': {
    api: 'Resource.destroy()',
    replacement: 'Resource.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-024': {
    api: 'SWController.destroy()',
    replacement: 'SWController.dispose()',
    removedIn: '2.0.0',
  },
  // #117 — یکدست‌سازی نام/مسیر: schedule alias شد؛ نصب stateful تک‌مسیر.
  'ZEN-DEPR-025': {
    api: 'schedule() (@zenith/scheduler)',
    replacement: 'scheduleEffect()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-026': {
    api: 'installStatefulComponents()',
    replacement: 'Zen.use(ZenithStatefulPlugin)',
    removedIn: '2.0.0',
  },
  // #147 — انتقال رجیستری devtools از @zenith/state به @zenith/devtools-core (SPEC §۲.۷).
  'ZEN-DEPR-027': {
    api: 'registerSignal (@zenith/state)',
    replacement: '@zenith/devtools-core registerSignal / installDevtoolsCore',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-028': {
    api: 'recordStateChange (@zenith/state)',
    replacement: '@zenith/devtools-core recordStateChange / installDevtoolsCore',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-029': {
    api: 'getAllSignals (@zenith/state)',
    replacement: '@zenith/devtools-core getAllSignals',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-030': {
    api: 'getSignalInfo (@zenith/state)',
    replacement: '@zenith/devtools-core getSignalInfo',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-031': {
    api: 'getStateTimeline (@zenith/state)',
    replacement: '@zenith/devtools-core getTimeline',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-032': {
    api: 'onStateChange (@zenith/state)',
    replacement: '@zenith/devtools-core onStateChange',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-033': {
    api: 'nameSignal (@zenith/state)',
    replacement: '@zenith/devtools-core nameSignal',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-034': {
    api: 'clearRegistry (@zenith/state)',
    replacement: '@zenith/devtools-core clearRegistry',
    removedIn: '2.0.0',
  },
  // #55 — حذف آرگومان‌های positional از توابع با >2 پارامتر (تبدیل به options object).
  'ZEN-DEPR-035': {
    api: 'createMutation(fn, options)',
    replacement: 'createMutation({ fn, ...options })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-036': {
    api: 'createInfiniteQuery(key, fn, options)',
    replacement: 'createInfiniteQuery({ key, fn, ...options })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-037': {
    api: 'trackPromise(promise, suspense, key, timeout)',
    replacement: 'trackPromise(promise, { suspense, key, timeout })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-038': {
    api: 'withTimeout(promise, ms, message)',
    replacement: 'withTimeout(promise, { ms, message })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-039': {
    api: 'animate(el, keyframes, duration, easing, delay, fill, onFinish)',
    replacement: 'animate(el, { keyframes, duration, easing, delay, fill, onFinish })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-040': {
    api: 'animateEnter(el, name, duration, easing, onFinish)',
    replacement: 'animateEnter(el, { name, duration, easing, onFinish })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-041': {
    api: 'animateLeave(el, name, duration, easing, onFinish)',
    replacement: 'animateLeave(el, { name, duration, easing, onFinish })',
    removedIn: '2.0.0',
  },
  // #119 — «یک نام، یک معنا»: نام‌های تکراری cross-package که به نام یکتا
  // تغییر کردند (DEC-035). aliasهای قدیمی در ۲.۰ حذف می‌شوند (DEC-026).
  'ZEN-DEPR-042': {
    api: 'registerCache (@zenith/devtools-core)',
    replacement: 'registerDevtoolsCache',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-043': {
    api: 'registerStore (@zenith/devtools-core)',
    replacement: 'registerDevtoolsStore',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-044': {
    api: 'registerSignal (@zenith/devtools)',
    replacement: 'registerPanelSignal',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-045': {
    api: 'recordStateChange (@zenith/devtools)',
    replacement: 'recordPanelStateChange',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-046': {
    api: 'invalidate (@zenith/data)',
    replacement: 'invalidateFetchCache',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-049': {
    api: 'validate (@zenith/expressions)',
    replacement: 'validateAst',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-050': {
    api: 'deprecate (@zenith/logger)',
    replacement: 'warnDeprecated',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-051': {
    api: 'mockHttp (@zenith/testing)',
    replacement: 'mockFetch',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-052': {
    api: 'alert (@zenith/notifications)',
    replacement: 'showAlert',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-053': {
    api: 'confirm (@zenith/notifications)',
    replacement: 'showConfirm',
    removedIn: '2.0.0',
  },
  // #118 — پاک‌سازی‌های سراسری که به resetForTesting()/@zenith/testing منتقل شدند
  'ZEN-DEPR-054': {
    api: 'clearActions',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-055': {
    api: 'clearComponents',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-056': {
    api: 'clearAuth',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-057': {
    api: 'clearPermissionManagers',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-058': {
    api: 'clearResources',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-059': {
    api: 'clearStores',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-060': {
    api: 'clearServerComponents',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-061': {
    api: 'clearEventModifiers',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-062': {
    api: 'clearCustomDirectives',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-063': {
    api: 'clearScheduler',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-064': {
    api: 'clearRegistry (@zenith/devtools-core)',
    replacement: 'resetForTesting() (@zenith/testing)',
    removedIn: '2.0.0',
  },
  // #55 — پیکربندی positional → options-object
  'ZEN-DEPR-065': {
    api: 'createSuspenseContext(timeoutMs, onSettle)',
    replacement: 'createSuspenseContext({ timeoutMs, onSettle })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-066': {
    api: 'processFetchWithCache(url, ttl)',
    replacement: 'processFetchWithCache(url, { ttl })',
    removedIn: '2.0.0',
  },
  // #55 — پیکربندی positional → options-object (موج تکمیلی: retry/timeout/i18n/cache/modifiers + driver/head)
  'ZEN-DEPR-067': {
    api: 'retryWithBackoff(mutation, maxRetries)',
    replacement: 'retryWithBackoff(mutation, { maxRetries })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-068': {
    api: 'raceWithTimeout(promise, timeoutMs)',
    replacement: 'raceWithTimeout(promise, { timeoutMs })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-069': {
    api: 'te(key, locale) / tm(key, locale)',
    replacement: 'te(key, { locale }) / tm(key, { locale })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-070': {
    api: 'readFetchCache(url, ttl)',
    replacement: 'readFetchCache(url, { ttl })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-071': {
    api: 'applyBehaviorModifiers(event, modifiers, element, listenerIsPassive)',
    replacement: 'applyBehaviorModifiers(event, modifiers, { element, listenerIsPassive })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-106': {
    api: 'driverByName(name, cookieOpts, idbOpts)',
    replacement: 'driverByName(name, { cookie, indexedDB })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-107': {
    api: 'renderSSRHead(head, i18n, fallbackLocale)',
    replacement: 'renderSSRHead(head, { i18n, fallbackLocale })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-108': {
    api: 'hydrate(root, initFn) (@zenith/ssr)',
    replacement: 'hydrate(root, init?) (@zenith/runtime-core)',
    removedIn: '2.0.0',
  },
};