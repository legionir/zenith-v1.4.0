# Changelog

تمام تغییرات قابل‌توجه این پروژه در این فایل ثبت می‌شود.

قالب‌بندی بر اساس [Keep a Changelog](https://keepachangelog.com/fa/1.1.0/) و نسخه‌بندی [Semantic Versioning](https://semver.org/lang/fa/) است.

---

## [1.4.0] — ۲۰۲۶-۰۷-۰۵

### خلاصه

نسخه‌ی **Major Audit Fixes** — رفع جامع تمام یافته‌های گزارش‌های حسابرسی (audit) شامل **۱۵۶+ باگ و ۷۰+ بهبود** در تمام ۳۱ پکیج. این بزرگ‌ترین به‌روزرسانی Zenith از نظر تعداد تغییرات است که تمام گزارش‌های مستقل حسابرسی (audit) را پوشش می‌دهد.

### 🔴 Core Engine (state, expressions, scheduler, runtime)

#### @zenith/state — ۷ باگ + ۷ بهبود
- **BUG-01**: رفع `update()` — مقدار `oldValue` قبل از assignment ذخیره می‌شود
- **BUG-03**: پیاده‌سازی Lazy Initialization برای Computed (جلوگیری از اجرای دوبار computation)
- **BUG-04**: رفع نشت حافظه در registry.ts — پاکسازی دوره‌ای ۶۰ ثانیه‌ای با WeakMap
- **BUG-05**: شکستن circular dependency بین signal.ts و effect.ts با ماژول context.ts جدید
- **BUG-07**: افزودن Object.is() guard در update()
- **IMP-01**: Lazy Initialization برای Computed
- **IMP-03**: استخراج Context به ماژول مجزا (`context.ts`)
- **IMP-05**: یکپارچه‌سازی پرچم DevTools (`devtools.ts`)
- **IMP-07**: Error Boundary برای Effectها با `onEffectError()` API

#### @zenith/expressions — ۹ باگ + ۳ بهبود
- **B-1**: افزودن رشته‌ی خالی قبل از اولین `${}` در template literal برای جلوگیری از جمع عددی
- **B-2**: افزودن `true/false/null/undefined` به‌عنوان Literal keyword
- **B-3**: جایگزینی `substr` (منسوخ) با `slice`
- **B-4**: پشتیبانی از `?.[]` (optional computed access) بعد از `?.`
- **B-6**: افزودن عملگر یکانی `+`
- **B-8**: ادغام NullishCoalescing با BinaryExpression/LogicalExpression
- **B-10**: بهبود پیام خطا برای `thisArg` برابر null/undefined
- **I-2/I-3**: افزودن `configureCache()`، `getCacheStats()`، ردیابی hits/misses/hitRatio

#### @zenith/scheduler — ۶ باگ + ۵ بهبود
- **B-01**: afterFlush disposer pattern
- **B-02**: SchedulerAdapter DI wiring
- **B-03**: Priority validation با warning
- **B-04**: Dead code removal
- **B-05**: Reentrancy fix
- **B-06**: Function → `() => void` type safety
- **E-01**: Priority queue optimization
- **E-02**: Debug hooks (`setSchedulerHooks`)
- **E-03**: `scheduleMicrotask` API
- **E-04**: Time-slicing
- **E-05**: SchedulerHooks interface

#### @zenith/runtime — ۱۲ باگ + ۱۲ بهبود
- **BUG-RUNT-01**: پاکسازی event delegation در `Zen.stop`
- **BUG-RUNT-02**: رفع وابستگی به `__ZENITH_DEV__` سراسری — تشخیص dev-mode در ۵ مرحله
- **BUG-RUNT-03**: رفع race condition در سیستم پلاگین با Promise-based locking
- **BUG-RUNT-04**: FOUC style detachment — بررسی `parentNode === document.head`
- **BUG-RUNT-05**: رفع نشت Listener در event delegation
- **BUG-RUNT-06**: رفع نشت HMR reload function
- **BUG-RUNT-07**: رفع race condition در DevTools hook
- **BUG-RUNT-08**: رفع مشکلات بارگذاری کامپوننت
- **BUG-RUNT-09**: خطای گنگ زمان missing root — بهبود error messages
- **BUG-RUNT-10**: تشخیص ناسازگار dev mode
- **BUG-RUNT-11**: reentrancy در flushSync با isFlushing guard
- **BUG-RUNT-12**: export ناقص error boundary — اضافه شدن `processErrorBoundary`، `showFallback`، `recoverFromError`
- **IMP-RUNT-01**: پاکسازی پیشرفته event delegation
- **IMP-RUNT-05**: component registry scoping
- **IMP-RUNT-06**: خطاهای راهنما با debugging hints
- **IMP-RUNT-07**: HMR lifecycle management
- **IMP-RUNT-11**: اضافه شدن `Zen.perf` با mark/measure/clear/getReport
- **IMP-RUNT-12**: export `PerfMeasure` و `ZenPerf` interfaces

### 🟠 DOM Directives (events, components, transition, error-boundary, suspense)

#### @zenith/events — ۲ باگ + ۲ بهبود
- **BUG-EVT-01**: رفع `clearBindingCache()` برای جایگزینی با WeakMap جدید (به جای فلگ `_cleared`)
- **BUG-EVT-04**: پاکسازی `timedHandlerCache` در `.once` modifier — جلوگیری از memory leak
- **IMP-EVT-04**: افزودن ۵ رویداد جدید به `DELEGATED_EVENTS`: dblclick, contextmenu, wheel, pointerdown, pointerup

#### @zenith/components — ۴ باگ + ۳ بهبود
- **BUG-COM-01**: افزودن `trackComponentLifecycle()`/`stopComponentTracking()` با MutationObserver برای cleanup خودکار کامپوننت‌ها
- **BUG-COM-02**: افزودن AbortController به `processAsyncComponent` — لغو in-flight fetch در dispose
- **BUG-COM-03**: `console.warn()` در `fillSlots()` وقتی slot content وجود دارد اما `<slot>` element در template نیست
- **BUG-COM-04**: افزودن `_processingStack: Set<string>` برای تشخیص circular reference در کامپوننت‌ها
- **IMP-COM-01**: Generic `ComponentDefinition<TProps>` + `defineComponent<TProps>()`
- **IMP-COM-02**: `ComponentLifecycle` interface با onMount/onDestroy/onUpdate hooks
- **IMP-COM-03**: `preloadVisibleComponents()` با IntersectionObserver و rootMargin: '200px'

#### @zenith/transition — ۴ باگ + ۳ بهبود
- **BUG-TRN-01**: پاکسازی `transitionend` بعد از timeout در تابع `finish()`
- **BUG-TRN-02**: جایگزینی double-rAF + force reflow با `getComputedStyle(el).transform`
- **BUG-TRN-03**: ایمن‌سازی cancel برای rapid toggle
- **BUG-TRN-04**: هندل کردن `transitioncancel` برای display:none و لغوهای مرورگر
- **IMP-TRN-01**: Web Animations API (WAAPI) به‌عنوان مسیر اصلی
- **IMP-TRN-02**: easing سفارشی با `validateEasing()` (پشتیبانی از cubic-bezier و steps())
- **IMP-TRN-03**: group transition با `animateGroup()` و staggerDelay پلکانی

#### @zenith/error-boundary — ۱ باگ
- **BUG-EB-01**: تغییر امضای `reportError` از `error: Error` به `error: unknown` — خطاهای غیر Error (string, null, undefined) به طور خودکار به ZenithError تبدیل می‌شوند

#### @zenith/suspense — ۱ باگ + ۱ بهبود
- **BUG-SUS-01**: پارامتر `onSettle` به `createSuspenseContext` اضافه شد — callback هم‌زمان برای parent بدون gap میکروتسک

### 🟡 Routing & Data (router, data, resource, crud, virtual-list)

#### @zenith/router — ۴ باگ + ۲ بهبود
- **BUG-RTR-01**: افزودن `normalizePath()` — حذف double slash و trailing slash در `matchRoute()`
- **BUG-RTR-03**: `registerRouterCleanup()` — پاکسازی link handlers، prefetch، route cache
- **BUG-RTR-04**: جایگزینی plain Map با LRUCache (O(1) LRU eviction)
- **IMP-RTR-01**: `beforeEach(guard)` — سیستم navigation guard قبل از `navigate()`
- **IMP-RTR-02**: پارامتر `replace?: boolean` به `navigate(path, options)` — استفاده از `history.replaceState()`

#### @zenith/data — ۴ باگ + ۲ بهبود
- **BUG-DAT-01**: پاکسازی AbortController در catch خطاهای غیر AbortError
- **BUG-DAT-02**: مدیریت Rate Limiting (429) با Retry-After، حداکثر ۳ بار تلاش مجدد
- **BUG-DAT-03**: پشتیبانی از zen-fetch-method و zen-fetch-body (POST/PUT/DELETE)
- **BUG-DAT-04**: اعتبارسنجی URL با `isValidUrl()` و `new URL()`
- **IMP-DAT-01**: پارامترهای query string با `zen-fetch-params`
- **IMP-DAT-02**: لایه کش ماژول-سطح (SWR-like) با `zen-fetch-cache` برای TTL اتوماتیک

#### @zenith/resource — ۴ باگ + ۲ بهبود
- **BUG-RES-01**: `canonicalize()` و `createCacheKey()` برای deterministic cache keys (صرف‌نظر از ترتیب کلیدهای JSON)
- **BUG-RES-02**: Snapshot versioning برای optimistic updates — جلوگیری از cross-update corruption
- **BUG-RES-03**: Extended retry policy برای network errors در non-GET methods
- **BUG-RES-04**: `registerDOMCleanup()`/`unregisterDOMCleanup()` — invoke در `destroy()`
- **IMP-RES-02**: Per-request AbortController برای selective request cancellation در ناوبری سریع

#### @zenith/crud — ۳ باگ + ۲ بهبود
- **BUG-CRD-01**: جایگزینی `resource.setData(() => snapshot)` با `rollbackWithMerge(current, snapshot)`
- **BUG-CRD-02**: افزودن `setNestedValue(obj, path, value)` و `collectFormData(formEl)` — پشتیبانی از nested keys
- **BUG-CRD-03**: افزودن attribute `data-auto-refresh` — امکان جلوگیری از auto-refresh بعد از create
- **IMP-CRD-01**: `crudBulkDelete` — حذف گروهی با Promise.all
- **IMP-CRD-02**: `crudSmartDelete` — auto-correct به صفحه قبل هنگام حذف آخرین آیتم

#### @zenith/virtual-list — ۴ باگ + ۳ بهبود
- **BUG-VL-01**: SSR guard — در محیط SSR همه آیتم‌ها رندر می‌شوند
- **BUG-VL-02**: Debounce prefix sum با `scheduleRebuild()` و timeout 16ms
- **BUG-VL-03**: Binary search bounds در `findItemByOffset()` — boundary checks کامل
- **BUG-VL-04**: Buffer پویا با `calculateDynamicBuffer()` بر اساس viewport size
- **IMP-VL-01**: Horizontal scrolling با پارامتر direction از attribute zen-direction
- **IMP-VL-02**: Item animation با presetهای fadeIn/slideDown/scaleIn
- **IMP-VL-03**: `scrollToIndex(index)` در VirtualListController

### 🟢 Business Runtime (form, store, auth, permission, i18n, stateful, store)

#### @zenith/form — ۳ باگ
- **BUG-FRM-02**: افزودن `_validationGeneration` به `_validateFieldAsync` — جلوگیری از race condition در async validation
- **BUG-FRM-03**: اعتبارسنجی index به `moveItem` و `removeItem` با خطای مشخص
- **BUG-FRM-05**: `setFieldDebounce(field, ms)` — پشتیبانی از debounce per-field (پیش‌فرض ۳۰۰ms)

#### @zenith/store — ۳ باگ + ۱ بهبود
- **BUG-STO-01**: `_visitingSet` (WeakSet) در `createInPlaceDeepProxy` برای تشخیص circular references
- **BUG-STO-02**: `DEEP_MERGE_MAX_DEPTH = 10` — محدودیت عمق برای deepMerge
- **BUG-STO-03**: استفاده از `Reflect.ownKeys` به‌جای `Object.keys` در deepMerge, $reset, $patch

#### @zenith/auth — ۴ باگ + ۳ بهبود
- **BUG-AUT-01**: افزودن `_clearRefreshTimer()` متمرکز + استفاده در destroy()، logout()، `_scheduleRefresh()`
- **BUG-AUT-02**: Refactoring refresh() → `_doRefresh()` با finally برای بازنشانی `_refreshPromise`
- **BUG-AUT-03**: افزودن `secureLogout()` با navigator.sendBeacon + fallback به fetch({ keepalive: true })
- **BUG-AUT-04**: فراخوانی خودکار `fetchUser()` در constructor اگر توکن معتبر موجود است
- **IMP-AUT-02**: پیاده‌سازی کامل Event Emitter: AuthEvent، on()، off()، `_emit()`
- **IMP-AUT-04**: بررسی `navigator.onLine` در `_scheduleRefresh` — منتظر ماندن برای online event

#### @zenith/permission — ۲ باگ + ۲ بهبود
- **BUG-PRM-01**: `deepFreeze()` utility و استفاده در `PermissionManager.freeze()` برای defense-in-depth
- **BUG-PRM-03**: try/catch به `createGuard()` برای fail-closed behavior در unexpected errors
- **IMP-PRM-03**: `requirePermission()` و `requireRole()` route guard factories

#### @zenith/i18n — ۴ باگ
- **BUG-I18N-01**: `if (year < 622) return ''` در `toJalali` — جلوگیری از محاسبه تاریخ قبل از هجرت
- **BUG-I18N-02**: جایگزینی replace ساده با `/\b...\b/g` (word boundary regex) در `formatJalali`
- **BUG-I18N-03**: null guard به `addDaysJalali` — بازگشت null به‌جای TypeError
- **BUG-I18N-04**: پارامتر اختیاری `text?` به `isRTL` — تشخیص کاراکترهای RTL در متن

#### @zenith/stateful — ۲ باگ
- **BUG-STF-01**: قبل از ثبت هر دایرکتیو بررسی می‌کند که آیا قبلاً ثبت شده — هشدار در صورت تکراری
- **BUG-STF-02**: `installStatefulComponents` تابع cleanup برمی‌گرداند که دایرکتیوها را پاک می‌کند

### 🔵 Security & SSR

#### @zenith/security — ۴ باگ + ۴ بهبود
- **BUG-SEC-01**: مسدودسازی SVG/MathML tags در sanitizer
- **BUG-SEC-02**: SSR fallback با `sanitizeHTMLSimple`
- **BUG-SEC-03**: اصلاح `sanitizeHTMLWithOptions`
- **BUG-SEC-04**: مسدودسازی `<template>` برای mutation XSS
- **IMP-SEC-01**: تابع `sanitizeCSS`
- **IMP-SEC-02**: تابع `generateCSP` با CSPOptions
- **IMP-SEC-03**: `createTrustedTypesPolicy`
- **IMP-SEC-04**: ماژول `security-constants.ts` با shared exports

#### @zenith/ssr — ۷ باگ
- **BUG-SSR-03**: HMR overwrite در server-component — هشدار `console.warn` هنگام overwrite
- **BUG-SSR-06**: CPU hog در Streaming SSR — پشتیبانی AbortSignal
- سایر باگ‌ها (BUG-SSR-01, 02, 04, 05, 07) از نسخه‌های قبل تأیید شدند

#### @zenith/service-worker — ۴ باگ
- **BUG-SW-01**: IndexedDB queue با per-item deletion
- **BUG-SW-02**: Exponential backoff محدود به ۳۰ ثانیه
- **BUG-SW-03**: SSR guard در registerSW
- **BUG-SW-04**: پاکسازی ناقص Cache در activate — version prefix `v{CACHE_VERSION}` به cache‌ها اضافه شد

### 🟣 Build & Tooling (compiler, vite-plugin, cli, devtools, vscode-extension)

#### @zenith/cli — ۴ باگ
- **BUG-CLI-01**: اعتبارسنجی runtime برای Actionهای تعریف‌نشده در mainTsTemplate و pwaMainTsTemplate — event listener کلیک با console.warn
- **BUG-CLI-03**: رفع directory traversal در lighthouse.ts — استفاده از `path.resolve() + path.sep`
- **BUG-CLI-04**: افزودن `detectPackageManager()` — تشخیص npm/yarn/pnpm
- **BUG-CLI-05**: افزودن `normalizeFilePath()` با `name.normalize('NFC')`

#### @zenith/compiler — ۸ باگ
- **BUG-COMP-01**: گسترش تشخیص تداخل directiveهای ساختاری — اضافه کردن zen-show به STRUCTURAL_DIRECTIVES
- **BUG-COMP-02**: رفع zen-bind object syntax — استفاده از `evalExpr("$isActive", ctx)` در object syntax
- **BUG-COMP-04**: بهبود zen-for expression parsing — استفاده از `evalExpr(listExprRaw, ctx)`
- **BUG-COMP-05**: بهینه‌سازی zen-for template embedding — فقط در صورت غیرخالی بودن innerHTML
- **BUG-COMP-06**: بهبود zen-key expression parsing — پشتیبانی از `item.user.profile.id` با عمق نامحدود
- **BUG-COMP-07**: بهبود مدیریت fallback برای compileCompilableDirective — warning + strict mode error
- **BUG-COMP-08**: غنی‌سازی error messages در strict mode — نمایش dir.value و element path

#### @zenith/vite-plugin — ۷ باگ + ۴ بهبود
- **B-1**: تشخیص isBuild با `config.isProduction || config.command === 'build'`
- **B-2**: Glob-to-regex با `globToRegex()` در watchPatterns
- **B-3**: buildStart hook برای پاکسازی pendingModules
- **B-4**: `replaceAll()` helper با escape کردن regex special chars
- **B-5**: Runtime directives با attribute `data-zenith-runtime`
- **B-6**: مسیر DevTools با require.resolve و config.root
- **B-7**: handleHotUpdate returns `[]`
- **B-9**: حذف duplicate EXPRESSION_DIRECTIVES
- **I-3**: buildEnd hook برای cleanup و آمار compile
- **I-7**: لاگ بهتر strict mode با stack trace کامل

#### @zenith/devtools — ۵ باگ + ۲ بهبود (۳ فایل)
- رفع نشت حافظه HMR (cacheStats.uniqueExpressions / activeSSRStores در module reload)
- تشخیص dev mode با ۳ سیگنال (flag → URL param → hostname)
- پاکسازی page unload با pagehide + visibilitychange + Vite import.meta.hot.dispose()
- ردیابی onStateChange subscriber‌ها برای پاکسازی در cleanup
- **graph.ts**: جلوگیری از dangling edges — addEdge() وجود نودها را قبل از افزودن یال چک می‌کند
- **graph-viewer.html**: زوم/پان با چرخ ماوس و درگ پس‌زمینه (cursor-anchored zoom)
- **graph-viewer.html**: تابع sanitize() برای جلوگیری از XSS روی label/idها

#### @zenith/devtools-extension — ۵ باگ + ۳ بهبود (۵ فایل)
- **content.js**: اصلاح `return true` به `return`
- **popup.js**: اسلایدر interval قابل تنظیم (۵۰۰ms تا ۵۰۰۰ms) با localStorage
- **popup.js**: Lazy render برای تب v1
- **popup.js**: نمایش خطای دقیق `chrome.runtime.lastError.message`
- **manifest.json**: محدود کردن host_permissions + توضیح کامل
- **graph-viewer.html**: زوم/پان + sanitize() + Toast error + visibilitychange

#### @zenith/vscode-extension — ۹ باگ + ۴ بهبود
- **B-1**: حذف "lineComment": "<!--" از language-configuration.json
- **B-2**: افزودن ۸ گرامر directive گم‌شده به tmLanguage.json
- **B-3**: تشخیص inValue با position + lastIndexOf('=')
- **B-4**: اولویت openDoc.getText() به‌جای fs.readFileSync
- **B-5**: onDidChangeTextDocument برای پاکسازی لحظه‌ای کش signal‌ها
- **B-6**: onDidCloseTextDocument برای پاکسازی diagnostics
- **B-7**: attrRegex با پشتیبانی از '...'
- **B-8**: پشتیبانی از `prop:*`
- **B-9**: بهینه‌سازی Levenshtein به 2-row DP (O(n) memory)
- **I-1**: ۸ directive جدید در ZENITH_DIRECTIVES
- **I-2**: Semantic Tokens Provider
- **I-7**: Signal Hover Provider
- **I-9**: Undo/redo با vscode.workspace.fs.writeFile

### 🟤 Infrastructure & Cross-cutting

#### @zenith/actions — ۲ باگ + ۲ بهبود
- **BUG-ACT-01**: افزودن متد `destroy()` برای پاکسازی کامل (HMR) — `_actions.clear()` + middleware‌ها
- **BUG-ACT-03**: `console.warn` در `register()` هنگام override اکشن قبلی
- **IMP-ACT-01**: middleware pipeline کامل با use()، execute() و ActionMiddleware type
- **IMP-ACT-02**: Export نوع ActionMiddleware

#### @zenith/errors — ۴ باگ + ۱ بهبود
- **BUG-ERR-01**: افزودن ۵ تابع کارخانه‌ای جدید: compileSyntaxError, compileMissingImportError, jsVmRuntimeError, jsVmTimeoutError, routerNavigationAbortedError
- **BUG-ERR-01**: افزودن کدهای خطای جدید: COMPILE_SYNTAX_ERROR (ZEN-503), COMPILE_MISSING_IMPORT (ZEN-504), JS_VM_RUNTIME_ERROR (ZEN-551), JS_VM_TIMEOUT (ZEN-552), JS_VM_MEMORY_LIMIT (ZEN-553), ROUTER_NAVIGATION_ABORTED (ZEN-603)
- **BUG-ERR-03**: بهبود `findClosestMatch` با maxDistance و آستانه نسبی
- **BUG-ERR-04**: تقویت `isZenithError` با duck typing دقیق‌تر
- **IMP-ERR-02**: پشتیبانی از خطاهای JS/VM با کدهای ZEN-551 تا ZEN-553

### 📊 آمار نسخه ۱.۴.۰

| معیار | مقدار |
|------|-------|
| باگ‌های رفع‌شده | ۱۵۶+ |
| بهبودهای اعمال‌شده | ۷۰+ |
| پکیج‌های تغییر یافته | ۳۱ |
| فایل‌های audit مورد بررسی | ۳۶ |
| نسخه قبلی | ۱.۳.۰ |

---

## [1.3.0] — ۲۰۲۶-۰۶-۲۷

### خلاصه

نسخه‌ی **minor** — ۵ قابلیت جدید API بر اساس گزارش فنی Core Engine + ۶ قابلیت جدید
بر اساس گزارش فنی `@zenith/events` و `@zenith/actions` (گام دوم، بخش دوم).

### 🚀 ویژگی‌های جدید API — Core Engine

#### ۱. `signal.update()` — کاهش Boilerplate

```typescript
// قبلاً (verbose):
user.set({ ...user.get(), age: 30 });

// حالا (v1.3.0):
user.update(v => { v.age = 30; return v; });
// یا:
items.update(arr => [...arr, newItem]);
```

همیشه subscribers را notify می‌کند — حتی اگر reference تغییر نکرده باشد.

#### ۲. `signal.peek()` — خواندن بدون ثبت وابستگی

```typescript
effect(() => {
  const userId = user.get();      // ← tracks (re-runs on change)
  const cache = items.peek();     // ← no track (doesn't re-run)
  if (!cache[userId]) fetch(userId);
});
```

#### ۳. `untrack()` — اجرای بدون tracking

```typescript
effect(() => {
  const userId = user.get();
  const cached = untrack(() => cache.get()); // ← no dependency
});
```

#### ۴. `configureScheduler()` — Dependency Injection برای Scheduler

```typescript
import { configureScheduler } from '@zenith/scheduler';

configureScheduler({
  schedule: (fn, priority) => requestAnimationFrame(fn),
  flush: () => { /* custom flush */ },
});
```

اجازه می‌دهد scheduler پیش‌فرض (microtask) با یک پیاده‌سازی سفارشی جایگزین شود — برای testing، deadline-based scheduling، یا time-slicing.

#### ۵. `security-constants.ts` مشترک (از v1.2.8)

تأیید شد که `FORBIDDEN_PROPERTIES` در یک منبع واحد (`security-constants.ts`) تعریف شده و هم validator و هم evaluator از آن استفاده می‌کنند.

### 🚀 ویژگی‌های جدید API — Events & Actions (گام دوم)

#### ۶. Event Modifier Registry — `registerEventModifier()`

Plugin ها می‌توانند modifier های سفارشی تعریف کنند:

```typescript
import { registerEventModifier } from '@zenith/events';

registerEventModifier('longpress', (event, modifiers, element) => {
  // پیاده‌سازی longpress
  return true;  // false = جلوگیری از اجرای اکشن
});

// HTML:
// <button zen-action:click.longpress="save">Long press to save</button>
```

Built-in modifier ها (`prevent`, `stop`, `immediate`, `self`, `once`, `debounce`,
`throttle`, `enter`, `escape`, ...) قابل override نیستند. API شامل `unregisterEventModifier`,
`clearEventModifiers`, `hasEventModifier`, `getEventModifier`, و `BUILTIN_MODIFIERS` است.

#### ۷. Binding Cache با WeakMap — Performance

نتایج parse کردن `zen-action:*` attribute ها حالا در یک
`WeakMap<HTMLElement, CachedBinding>` کش می‌شوند. اگر attribute ها تغییر نکرده
باشند، re-parse انجام نمی‌شود. وقتی attribute تغییر کند (مثلاً توسط `.once`)،
cache خودکار invalidate می‌شود. این feature کاملاً transparent است.

#### ۸. Custom Delegation Root — Shadow DOM / Subtree

```typescript
import { initEventDelegation } from '@zenith/events';

// روی ShadowRoot:
const teardown = initEventDelegation(state, { root: hostEl.shadowRoot });

// روی یک subtree:
const teardown = initEventDelegation(state, { root: myContainerEl });

// یا از طریق Zen.start:
Zen.start(hostEl, state, { delegationRoot: hostEl.shadowRoot });
```

پارامتر `options.root` قبول می‌کند: `Document` (پیش‌فرض) | `ShadowRoot` | `HTMLElement`.

#### ۹. Parameterized Actions — `zen-action="save($item)"`

```html
<button zen-action="save($product.id, $product.name)">Save</button>
<button zen-action="selectProduct($product)">Select</button>
<button zen-action="updateQuantity($product.id, 5)">Qty +5</button>
<button zen-action="namespace.test('hello', $product.price)">Test</button>
```

آرگومان‌ها با Expression Engine ارزیابی و در `ctx.args` قرار می‌گیرند:

```typescript
Zen.action('save', ({ state, args }) => {
  const [id, name] = args;
  // args = [42, "Widget"]
});
```

اگر اکشن بدون parens نوشته شود (`save`), `ctx.args` برابر `undefined` است
(backward compatible). پشتیبانی از string literals, nested expressions, و
namespace names (`cart.save`).

#### ۱۰. Instance-based Action Registry — `new ActionRegistry()`

```typescript
import { ActionRegistry } from '@zenith/actions';

const registry = new ActionRegistry();
registry.register('cart.save', (ctx) => { /* ... */ });
registry.register('admin.delete', (ctx) => { /* ... */ }, { description: '...' });

console.log(registry.list());  // برای DevTools
console.log(registry.getMeta('cart.save'));  // metadata
```

API های module-level (`registerAction`, `getAction`, ...) به یک singleton
پیش‌فرض delegate می‌شوند — backward compatible.

#### ۱۱. Action Namespace + Metadata — برای DevTools

```typescript
Zen.action('cart.save', (ctx) => { /* ... */ }, {
  description: 'ذخیره سبد خرید',
  category: 'cart',
  permissions: ['cart:write'],
  deprecated: false,
});

// لیست برای DevTools:
const all = Zen.action.list();
// → [{ name: 'cart.save', metadata: { description: '...', category: 'cart', ... } }, ...]

// متادیتای یک اکشن:
const meta = Zen.action.getMeta('cart.save');
```

نام‌ها می‌توانند شامل `.` برای namespacing باشند: `cart.save`, `admin.delete`,
`editor.format.bold`. اعتبارسنجی نام از تداخل و کاراکترهای غیرمجار جلوگیری می‌کند.

### 📦 APIهای جدید

| پکیج | API | توضیح |
|------|-----|-------|
| `@zenith/state` | `signal.update(fn)` | Mutate value با تابع، همیشه notify |
| `@zenith/state` | `signal.peek()` | خواندن بدون dependency tracking |
| `@zenith/state` | `untrack(fn)` | اجرای بدون tracking |
| `@zenith/scheduler` | `configureScheduler(adapter)` | DI برای scheduler |
| `@zenith/events` | `registerEventModifier(name, handler)` | ثبت modifier سفارشی |
| `@zenith/events` | `unregisterEventModifier(name)` | حذف modifier سفارشی |
| `@zenith/events` | `clearEventModifiers()` | پاکسازی تمام modifier های سفارشی |
| `@zenith/events` | `hasEventModifier(name)` | بررسی وجود modifier |
| `@zenith/events` | `getEventModifier(name)` | دریافت handler modifier |
| `@zenith/events` | `BUILTIN_MODIFIERS` | Set از نام modifier های built-in |
| `@zenith/events` | `initEventDelegation(state, options)` | پارامتر `options.root` اضافه شد |
| `@zenith/events` | `clearBindingCache()` | پاکسازی Binding Cache |
| `@zenith/actions` | `ActionRegistry` (class) | کلاس برای instance-based registry |
| `@zenith/actions` | `registerAction(name, fn, metadata?)` | پارامتر سوم metadata اضافه شد |
| `@zenith/actions` | `getActionMeta(name)` | دریافت متادیتای اکشن |
| `@zenith/actions` | `listActions()` | لیست تمام actions با متادیتا |
| `@zenith/actions` | `getDefaultRegistry()` | دسترسی به singleton پیش‌فرض |
| `@zenith/runtime` | `Zen.action.list()` | میانبر برای listActions |
| `@zenith/runtime` | `Zen.action.getMeta(name)` | میانبر برای getActionMeta |
| `@zenith/runtime` | `Zen.action.has(name)` | میانبر برای hasAction |
| `@zenith/runtime` | `Zen.action.clear()` | میانبر برای clearActions |
| `@zenith/runtime` | `Zen.start(root, state, { delegationRoot })` | گزینه‌ی `delegationRoot` اضافه شد |
| `ActionContext` | `args?: any[]` | فیلد جدید برای parameterized actions |

### 🔧 بهبودهای داخلی

- **Sync drift**: `applyBehaviorModifiers` در `src/modifiers.ts` با `dist/modifiers.js`
  هم‌سان شد — حالا boolean برمی‌گرداند و `element` می‌گیرد (برای `.self` modifier).
- **Sync drift**: `DELEGATED_EVENTS` در src شامل `focusin`/`focusout` شد (تطابق با dist).
- **Sync drift**: فراخوانی `applyBehaviorModifiers` در `src/delegation.ts` حالا از
  return value استفاده می‌کند (تطابق با dist).
- **Dependency جدید**: `@zenith/events` به `@zenith/expressions` وابسته شد (برای
  ارزیابی آرگومان‌های parameterized actions).
- **`createContextForEval`** در `delegation.ts`: helper سبک برای ساخت context از
  state (با unwrap کردن signal ها) بدون circular dependency با runtime.

### ✅ سازگاری

- **هیچ breaking change‌ای وجود ندارد**. تمام APIهای v1.2.9 حفظ شدند.
- `update()`، `peek()`، `untrack()` متدهای جدیدی هستند که به Signal اضافه شدند.
- `configureScheduler()` API surface جدیدی است (full integration در v1.4.0).
- `initEventDelegation(state)` بدون options همچنان کار می‌کند (پیش‌فرض: `document`).
- `registerAction(name, fn)` بدون metadata همچنان کار می‌کند.
- `zen-action="save"` بدون parens همچنان کار می‌کند (`ctx.args === undefined`).
- `Zen.action(name, fn)` همچنان کار می‌کند (metadata پارامتر سوم اختیاری است).
- تمام module-level API های `@zenith/actions` به singleton پیش‌فرض delegate می‌شوند.

### 🧪 تست شده در مرورگر

تمام قابلیت‌های جدید در `/demos/events/index.html` به‌صورت زنده تست شده‌اند:
- ✅ Parameterized Actions با ۴ حالت مختلف (string, number, object, namespace)
- ✅ Custom Event Modifier (`.debug`) به‌تنهایی و در ترکیب با `.prevent`
- ✅ Action Metadata و `Zen.action.list()` برای DevTools
- ✅ Binding Cache invalidation هنگام `.once` (attribute حذف می‌شود)
- ✅ Namespace support (`cart.save`, `admin.delete`, `namespace.test`)

---

## [1.2.9] — ۲۰۲۶-۰۶-۲۷

### خلاصه

نسخه‌ی **patch** — رفع ۷ باگ از گزارش جامع ممیزی v1.2.8.

### 🔴 باگ‌های بحرانی

- **BUG-01**: Compiler codegen برای expressions پیچیده شکسته بود — `evalExpr` به‌عنوان پارامتر ۹ render() اضافه شد. تمام expressions با `evaluateExpression` واقعی ارزیابی می‌شوند (نه regex replace).

### 🟠 باگ‌های مهم

- **BUG-02**: `OBJECT_PROTO_BUILTINS` در هر `evaluate()` ساخته می‌شد — به module-level منتقل شد.
- **BUG-03**: CRUD XSS — تأیید شد که data rows از `zen-text` (textContent، XSS-safe) استفاده می‌کنند و labels با `escapeHtml` escape می‌شوند.
- **BUG-04**: `addDaysJalali` ورودی Date را mutate می‌کرد — `new Date(date.getTime())` برای کپی واقعی.
- **BUG-05**: `$patch` فقط shallow merge — `deepMerge` helper برای recursive merge.
- **BUG-06**: zen-for + zen-else-if/zen-else تداخل — `STRUCTURAL_DIRECTIVES` priority + warning.
- **BUG-08**: `_scheduleRefresh` بدون `_destroyed` guard — guard در متد و callback اضافه شد.

---

## [1.2.8] — ۲۰۲۶-۰۶-۲۷

### خلاصه

نسخه‌ی **Final Audit Fixes** — رفع ۱۰ یافته‌ی باقی‌مانده از ممیزی جامع
v1.2.6/v1.2.7. هفت یافته به‌صورت فعال در این نسخه رفع شدند و سه یافته
(srcset multi-URL bypass در sanitizer، pattern ReDoS در form validator، و
six missing compiler directives) از قبل در v1.2.6/v1.2.7 رفع شده بودند و
فقط در این entry برای کامل بودن CHANGELOG تأیید می‌شوند. تمام رفع‌ها به‌صورت
هم‌زمان در `src` و `dist` اعمال شده‌اند و با کامنت‌های `// FIX (v1.2.8):`
مشخص شده‌اند.

### 🔴 Critical

- **P0-1** (`@zenith/runtime` — `packages/runtime/src/walker.ts` +
  `dist/walker.js`):
  `processIfChain` (پردازشگر زنجیره‌ی `zen-if` / `zen-else-if` /
  `zen-else`) قبلاً فقط `style.display` را toggle می‌کرد. این باعث
  می‌شد branchهای غیرفعال در DOM باقی بمانند، Effectهای فرزندانشان فعال
  بماند، و Event Listenerها/Zen-for/Zen-fetch داخل branchهای مخفی همچنان
  کار کنند. این دقیقاً همان باگی بود که `processIf` برای جلوگیری از آن
  طراحی شده بود. پیاده‌سازی جدید از mount/unmount با comment placeholder
  استفاده می‌کند: هر عنصر در زنجیره با یک Comment جایگزین می‌شود، فقط
  branch فعال mount می‌شود (درج قبل از placeholder و walk children با
  disposes array اختصاصی)، و switch کردن branch، disposes فرزندان branch
  قبلی را اجرا کرده و آن را از DOM حذف می‌کند.

### 🟠 High

- **P1-1** (`@zenith/expressions` — `packages/expressions/src/validator.ts`
  + `src/evaluator.ts` + `dist/validator.js` + `dist/evaluator.js` + جدید
  `src/security-constants.ts` + `dist/security-constants.js`):
  `FORBIDDEN_PROPERTIES` قبلاً به‌صورت جداگانه در Validator (تنها
  constructor/__proto__/prototype) و Evaluator (همان‌ها به‌علاوه‌ی
  __defineGetter__/__defineSetter__) نگهداری می‌شد. این drift باعث می‌شد
  دسترسی‌های `__lookupGetter__` و `__lookupSetter__` از Validator عبور
  کنند. یک فایل مشترک `security-constants.ts`/`.js` با لیتی frozen از هفت
  پراپرتی ممنوعه (constructor، __proto__، prototype، __defineGetter__،
  __defineSetter__، __lookupGetter__، __lookupSetter__) ساخته شد و هر دو
  ماژول از آن ایمپورت می‌کنند.

- **P1-2** (`@zenith/store` — `packages/store/src/store.ts` +
  `dist/store.js`):
  `$reset()` قبلاً فقط کلیدهای top-level را در `stateObj` با
  `createInPlaceDeepProxy` دوباره wrap می‌کرد. آبجکت‌های nested که قبلاً
  wrap شده بودند، proxy قدیمی خود را در `_proxiedSet` (WeakSet سراسری)
  نگه می‌داشتند، در نتیجه یک mutation عمیق بعد از reset روی یک آبجکت
  nested، `triggerReactive` را trigger نمی‌کرد (چون `createInPlaceDeepProxy`
  شیء را as-is برمی‌گرداند). راه‌حل: یک state تازه از `def.state()` ساخته
  می‌شود، کل آن با `createInPlaceDeepProxy` wrap می‌شود (که nested را
  به‌صورت lazy wrap می‌کند)، و سپس کلیدهای آن در `stateObj` کپی می‌شوند.
  Proxyهای قدیمی nested دیگر از طریق `stateObj` قابل دسترسی نیستند و
  به‌طور طبیعی از WeakSet GC می‌شوند.

- **P1-3** (`@zenith/runtime` — `packages/runtime/src/directives/virtual-repeat.ts`
  + `dist/directives/virtual-repeat.js`):
  `zen-virtual` قبلاً فرض می‌کرد scroll container همیشه
  `parent.closest('table').parentElement` (حالت table) یا
  `contentContainer.parentElement.parentElement` (حالت generic) است. این
  فرض برای دو الگوی رایج می‌شکست: ۱) خود عنصر list دارای `overflow-y: auto`
  باشد (در این حالت scroller خود wrapper است نه parent آن). ۲) scroll
  container چند سطح بالاتر باشد (layout با flex/grid containers تو در تو).
  یک helper جدید `findScrollContainer` اضافه شد که از `startEl` به سمت بالا
  حرکت می‌کند، `getComputedStyle(node).overflowY` را در هر سطح چک می‌کند،
  و اولین عنصر با overflow-y قابل scroll را برمی‌گرداند. fallback به
  `document.scrollingElement`.

- **P1-6** (`@zenith/runtime` — `packages/runtime/src/directives/memo.ts`
  + `dist/directives/memo.js`):
  `processMemo` قبلاً `lastValue = value` را قبل از `processChildren` ست
  می‌کرد. اگر `processChildren` پرتاب می‌کرد، effect بعدی مقدار جدید را در
  `lastValue` می‌دید، آن را equal مقایسه می‌کرد، و re-process را skip
  می‌کرد — زیردرخت را در یک حالت نیمه‌rendered خراب برای همیشه رها
  می‌کرد. راه‌حل: `lastValue = value` به بعد از موفقیت `processChildren`
  منتقل شد. در catch block، `lastValue` آپدیت نمی‌شود تا effect بعدی
  retry کند.

- **P1-7** (`@zenith/runtime` — `packages/runtime/src/directives/optimistic.ts`
  + `dist/directives/optimistic.js`):
  `zen-optimistic` قبلاً action را بدون timeout await می‌کرد. یک action
  hung (network stall، deadlock، promise هرگز resolve نشده) باعث می‌شد
  state optimistic برای همیشه اعمال بماند و دکمه در حالت "loading" گیر
  کند. حالا action در `Promise.race` با یک timeout ۱۰ ثانیه‌ای wrap
  می‌شود. در timeout، state optimistic rollback می‌شود و یک TimeoutError
  به error-boundary گزارش می‌شود. timer در `finally` پاکسازی می‌شود.

### 🟡 Medium

- **P2-5** (`@zenith/components` — `packages/components/src/async-loader.ts`
  + `dist/async-loader.js`):
  `loadComponent` قبلاً failureها را cache نمی‌کرد. هر render بعدی همان
  `<zen-async-component src="...">` دوباره URL را fetch و دوباره fail
  می‌کرد — تولید thundering-herd از requestهای بی‌فایده برای یک URL
  known-bad (مثلاً یک component مفقود در حین deploy storm). یک `errorCache`
  Map با TTL ۳۰ ثانیه‌ای اضافه شد. تا زمانی که entry وجود دارد،
  `loadComponent` فوراً بدون re-fetch خطا پرتاب می‌کند. بعد از ۳۰s entry
  expire می‌شود و URL retry می‌شود.

### ✅ Already Fixed (تأیید در این نسخه)

- **P1-9** (`@zenith/security` — `packages/security/src/sanitizer.ts` +
  `dist/sanitizer.js`):
  srcset multi-URL bypass. قبلاً در v1.2.6 (SEC-A4) رفع شده بود. validator
  اکنون srcset را روی کاماها split می‌کند و هر URL را به‌صورت جداگانه با
  `hasDangerousProtocol` چک می‌کند.

- **P2-7** (`@zenith/form` — `packages/form/src/validator.ts` +
  `dist/validator.js`):
  pattern: regex ReDoS. قبلاً در v1.2.6 (SEC-A11) رفع شده بود. input length
  قبل از regex test به ۱۰۰۰ کاراکتر cap می‌شود و کامنت اضافه شده که
  `pattern:` فقط برای static patternهای developer-authored است.

- **P2-14** (`@zenith/compiler` — `packages/compiler/src/compiler.ts` +
  `dist/compiler.js`):
  Missing v1.2.x directives. قبلاً در v1.2.7 رفع شده بود. هر شش directive
  (zen-track، zen-date-picker، zen-optimistic، zen-island، zen-memo،
  zen-virtual) اکنون در `RUNTIME_DIRECTIVES` هستند.

### Infrastructure

- All **31** `packages/*/package.json` bumped `1.2.7` → `1.2.8`.
- `packages/devtools-extension/manifest.json` bumped `1.2.7` → `1.2.8`.
- `index.html`: title → `v1.2.8`, all 3 download links →
  `zenith-v1.2.8.zip`, footer button text → `v1.2.8`.
- `mobile.html`: download link → `zenith-v1.2.8.zip`, text → `v1.2.8`.
- `docs/CHANGELOG.md`: new `## [1.2.8]` section prepended.
- `docs/README.md`: version badge → `1.2.8`.
- `docs/LLM-GUIDE.md`: `version`, `framework_version`, footer → `1.2.8`.
- `download/zenith-v1.2.8.zip` created, excluding `download/` and
  `node_modules/`.

### Verification

- `node --check` on all modified dist files: ALL OK.
- HTTP check: `/demos/router/index.html` → **200**.

---

## [1.2.7] — ۲۰۲۶-۰۶-۲۷

### خلاصه

نسخه‌ی **Integration Audit Fixes** — رفع ۱۵ یافته‌ی یکپارچه‌سازی که طی ممیزی
دوباره‌ی v1.2.6 شناسایی شدند. این رفع‌ها به ۸ پکیج (`events`، `router`،
`crud`، `suspense`، `error-boundary`، `compiler`، `virtual-list`،
`service-worker`) مربوط می‌شوند و همگی به‌صورت هم‌زمان در `src` و `dist`
اعمال شده‌اند و با کامنت‌های `// FIX (v1.2.7):` مشخص شده‌اند.

### 🔴 Critical

- **#1** (`@zenith/events` — `packages/events/src/delegation.ts` +
  `dist/delegation.js`):
  بلوک `.once` modifier در `dist` وجود داشت اما در `src` نبود. این باعث
  می‌شد درソسبیلد از سورس، اکشن‌های `zen-action:click.once` بعد از اولین
  اجرا حذف نشوند و مجدداً fire شوند. بلوک از `dist` به `src` پورت شد.

- **#13** (`@zenith/virtual-list` — `packages/virtual-list/src/virtual-list.ts`
  + `dist/virtual-list.js`):
  `templateContent.cloneNode(true)` یک `DocumentFragment` برمی‌گرداند که
  `.style` ندارد، اما کد آن را به `HTMLElement` cast می‌کرد و سپس
  `newNode.style.position = ...` را فراخوانی می‌کرد →
  `TypeError: can't access property "position", newNode.style is undefined`.
  راه‌حل: fragment در یک `<div>` واقعی wrap می‌شود، styleها روی div اعمال
  می‌شوند، و `processChildren` روی فرزندانِ div اجرا می‌شود.

### 🟠 High

- **#2** (`@zenith/events` — همان فایل):
  `applyTimingModifiers` صادر می‌شد اما هرگز فراخوانی نمی‌شد، در نتیجه
  `.debounce.NNN` / `.throttle.NNN` modifierها بی‌اثر بودند. حالا در
  `delegateEvent`، اکشن invocation در یک closure extract می‌شود، با
  `applyTimingModifiers` wrap می‌شود، و wrapped handler به‌ازای
  `(element, eventName:actionName)` cache می‌شود. Teardown این timerها را
  cancel می‌کند.

- **#3** (`@zenith/router` — `packages/router/src/outlet.ts` + `dist/outlet.js`):
  هنگام lazy-loading یک مسیر جدید، fetch قبلی لغو نمی‌شد. اگر کاربر سریع
  navigate می‌کرد، response مسیر قبلی می‌توانست روی مسیر جدید overwrite
  شود. حالا یک `AbortController` per-processRouter اضافه شد؛ در شروع fetch
  جدید، قبلی abort می‌شود؛ signal به `fetchPageCached` و سپس `fetch` پاس
  داده می‌شود؛ `AbortError` بی‌صدا handle می‌شود.

- **#5** (`@zenith/crud` — `packages/crud/src/crud-engine.ts` +
  `dist/crud-engine.js`):
  اکشن‌های CRUD (row/table actions) permission check را فقط در زمان render
  (پنهان‌کردن دکمه) انجام می‌دادند، نه در زمان fire. یک event crafted یا یک
  DOM stale می‌توانست اکشن را trigger کند. حالا `guardAction` یک پارامتر
  اختیاری `permission` می‌گیرد و قبل از اجرای user action، permission را با
  `getPermissionManager().checkPermission(...)` re-check می‌کند.

- **#7** (`@zenith/suspense` — `packages/suspense/src/suspense.ts` +
  `dist/suspense.js`):
  وقتی `timedOut` به `true` تبدیل می‌شد، دیگر هرگز `false` نمی‌شد — boundary
  برای همیشه روی fallback تایم‌اوت می‌ماند. حالا: وقتی همه‌ی فرزندان
  finish شدند (`pendingCount === 0`)، `timedOut` ریست می‌شود (recovery)؛
  وقتی loading جدید بعد از تایم‌اوت شروع می‌شود، timer دوباره arm می‌شود؛
  متد عمومی `reset()` برای بازیابی دستی اضافه شد.

- **#9** (`@zenith/error-boundary` — `packages/error-boundary/src/directive.ts`
  + `dist/directive.js`):
  `processErrorBoundary` هرگز fallback را نشان نمی‌داد! errors reported توسط
  child directiveها به global handler می‌رفت اما boundary محلی هیچ واکنشی
  نشان نمی‌داد. حالا یک `onError` listener scoped به boundary نصب می‌شود؛
  وقتی error با `element` در subtree این boundary رخ دهد، فرزندان dispose
  می‌شوند و fallback UI swap می‌شود.

- **#10** (`@zenith/events` — `packages/events/src/delegation.ts` +
  `dist/delegation.js`):
  خطاهای sync و async در actionها فقط `console.error` می‌شدند و به
  error-boundary گزارش نمی‌شدند، در نتیجه یک `zen-error` ancestor هرگز
  fallback را نشان نمی‌داد. حالا در هر دو catch block، `reportError(err,
  'action', { element })` فراخوانی می‌شود.

- **#14** (`@zenith/service-worker` — `packages/service-worker/src/sw.ts` +
  `dist/sw.js`):
  در background sync، بعد از حلقه‌ی retry، کل queue با `saveQueue(remaining)`
  بازنویسی می‌شد که `store.clear()` + `put` انجام می‌داد. اگر یک mutation
  جدید در حین retry loop اضافه می‌شد (مثلاً یک POST آفلاین)، silent drop
  می‌شد. حالا هر mutation بعد از retry موفق (یا drop بعد از ۳ ناموفق) با
  `removeFromQueue(mutation.id)` بلافاصله از IndexedDB حذف می‌شود.

### 🟡 Medium

- **#4** (`@zenith/router` — `packages/router/src/router.ts` + `dist/router.js`):
  `navigate('/page#section')` وقتی صفحه‌ی `/page` بود، کل route را re-render
  می‌کرد. حالا اگر pathname و search یکسان باشند و فقط hash متفاوت باشد،
  فقط `pushState` صدا زده می‌شود و `routeSignal` دست نمی‌خورد. مقایسه با
  `new URL(path, base)` برای robustness.

- **#6** (`@zenith/crud` — `packages/crud/src/crud.ts` + `dist/crud.js`):
  `crudDelete` بعد از حذف موفق، resource را refresh نمی‌کرد. optimistic
  filter فقط row را محلی پنهان می‌کرد، در نتیجه side-effectهای سرور
  (reordering، computed columns، cascade deletes) دیده نمی‌شد. حالا بعد از
  `result.success`، `resource.list(true)` صدا زده می‌شود.

- **#8** (`@zenith/suspense` — `packages/suspense/src/suspense.ts` +
  `dist/suspense.js`):
  nested `<zen-suspense>` به outer boundary منتقل نمی‌شد. outer می‌توانست
  loading را کامل کند (فرزندان مستقیم process شده) و inner را dispose کند
  قبل از تکمیل fetchهای inner. حالا در `processSuspense`، inner boundary با
  `outerCtx.startLoading(innerId)` ثبت می‌شود؛ یک effect وضعیت inner را
  watch می‌کند و هنگام settle شدن، `stopLoading(innerId)` صدا می‌زند.

- **#11** (`@zenith/error-boundary` — `packages/error-boundary/src/directive.ts`
  + `dist/directive.js`):
  `recoverFromError` فقط `clearError()` می‌زد و محتوای اصلی را restore
  نمی‌کرد. حالا `__zenithOriginalHTML__` در زمان process روی element ذخیره
  می‌شود، و `recoverFromError` آن را به `el.innerHTML` برمی‌گرداند (caller
  باید walker را دوباره اجرا کند).

- **#12** (`@zenith/compiler` — `packages/compiler/src/compiler.ts` +
  `dist/compiler.js`):
  ۶ directive runtime-only در `RUNTIME_DIRECTIVES` وجود نداشتند:
  `zen-track`، `zen-date-picker`، `zen-optimistic`، `zen-island`، `zen-memo`،
  `zen-virtual`. compiler آنها را به‌صورت unknown drop می‌کرد و attribute
  روی element حفظ نمی‌شد. همگی به set اضافه شدند.

- **#15** (`@zenith/service-worker` — `packages/service-worker/src/strategies.ts`
  + `dist/strategies.js`):
  `networkFirst` برای timeout از `Promise.race` استفاده می‌کرد که fetch را
  لغو نمی‌کرد — fetch در پس‌زمینه به مصرف bandwidth ادامه می‌داد. حالا از
  `AbortController` استفاده می‌شود؛ `clearTimeout` بعد از تکمیل fetch
  (موفق یا غیر timeout) timer leak را جلوگیری می‌کند.

### Infrastructure

- همه‌ی ۳۱ `package.json` از `1.2.6` به `1.2.7` bump شدند.
- `packages/devtools-extension/manifest.json` به `1.2.7`.
- `index.html`: title → `v1.2.7`، هر ۳ download link →
  `download/zenith-v1.2.7.zip`، footer button text → `v1.2.7`.
- `mobile.html`: download link → `zenith-v1.2.7.zip`، text → `v1.2.7`.
- `docs/CHANGELOG.md`: این بخش جدید `## [1.2.7]` اضافه شد.
- `docs/README.md`: version badge → `1.2.7`.
- `docs/LLM-GUIDE.md`: `version`، `framework_version`، footer → `1.2.7`.
- `download/zenith-v1.2.7.zip` ساخته شد (بدون `download/` و `node_modules/`).

### Verification

- `node --check` روی همه‌ی فایل‌های dist تغییرکرده: همگی OK.
- `bun run lint`: خطای جدیدی معرفی نشد.
- HTTP check: `curl -s -o /dev/null -w "%{http_code}"
  http://localhost:3000/demos/router/index.html` → **200**.

---

## [1.2.6] — ۲۰۲۶-۰۶-۲۶

### خلاصه

نسخه‌ی **Security Patch** — رفع ۱۳ یافته‌ی امنیتی از ممیزی جامع v1.2.5. این نسخه
رفع‌های بحرانی (Critical)، بالا (High)، متوسط (Medium) و پایین (Low) را در ۸ پکیج
(`ssr`، `runtime`، `security`، `permission`، `auth`، `expressions`، `form`)
ارائه می‌دهد. تمام رفع‌ها به‌صورت هم‌زمان در `src` و `dist` اعمال شده‌اند و با
کامنت‌های `// SEC FIX (v1.2.6):` مشخص شده‌اند.

### 🔴 Critical

- **SEC-A1** (`@zenith/ssr` — `packages/ssr/src/render.ts` + `dist/render.js`):
  SSR route injection. قبلاً state با escape کردن `<` ایمن‌سازی می‌شد اما route
  به‌صورت خام با `JSON.stringify` emit می‌شد. یک route مهاجمانه‌ی شامل `</script>`
  می‌توانست تگ script را ببندد و کد تزریق کند.
  - اضافه‌شدن helper `safeScriptValue(jsonString)` که `<`، `>`، U+2028 و U+2029 را
    escape می‌کند.
  - اعمال آن روی **هر دو** state و route در `generateHydrationScript` و
    `renderToStream`.
  - اضافه‌شدن `isRouteSafe(route)` که route حاوی `</` را رد می‌کند و در محل
    استفاده `console.error` می‌زند.

### 🟠 High

- **SEC-A2** (`@zenith/runtime` — `packages/runtime/src/directives/bind.ts` +
  `dist/directives/bind.js`):
  `zen-bind:href`/`src`/etc. می‌توانستند مقدار `javascript:alert(1)` را به
  setAttribute بدهند و یک click-to-XSS sink بسازند.
  - اضافه‌شدن `URL_ATTRS` (href, src, action, formaction, xlink:href, data,
    srcset, cite, poster, background).
  - اضافه‌شدن `hasDangerousUrlProtocol(value)` که javascript:, vbscript: و
    data: غیر-image را بلاک می‌کند (control chars و leading whitespace هم
    strip می‌شوند تا `java\x00script:` هم بلاک شود).
  - برای جلوگیری از circular dep با `@zenith/security`، چک به‌صورت inline
    در خود `bind.ts` قرار گرفت.

- **SEC-A3** (`@zenith/security` — `packages/security/src/sanitizer.ts` +
  `dist/sanitizer.js`):
  - اضافه‌شدن تگ‌های SVG/SMIL `ANIMATE`, `ANIMATEMOTION`, `ANIMATETRANSFORM`, `SET`
    به `FORBIDDEN_TAGS` — این تگ‌ها می‌توانند attribute را در runtime animate
    کنند و یک attribute بی‌خطر را بعد از load به `javascript:` تبدیل کنند.
  - در چک `style` attribute اضافه‌شدن بلاک‌های `-moz-binding`, `behavior:`,
    `@import`.
  - رفع باگ operator precedence در چک `vbscript:` — قبلاً
    `lowerValue.includes('url(') && lowerValue.includes('vbscript:')` به‌خاطر
    تقدم `&&` روی `||` فقط زمانی `vbscript:` را بلاک می‌کرد که `url(` هم در
    value بود. حالا `vbscript:` مستقلاً بلاک می‌شود.

- **SEC-A4** (`@zenith/security` — همان فایل):
  srcset multi-URL bypass. قبلاً `hasDangerousProtocol(attrValue)` فقط ابتدای
  کل رشته‌ی srcset را چک می‌کرد، در نتیجه URL دوم در `/a.jpg, javascript:...`
  عبور می‌کرد. حالا srcset روی کاما split می‌شود و هر URL جداگانه چک می‌شود.

- **SEC-A5** (`@zenith/permission` — `packages/permission/src/permission.ts` +
  `dist/permission.js` + `directive.ts` + `dist/directive.js`):
  - `createGuard`: وقتی PermissionManager ثبت نشده بود، `true` برمی‌گرداند
    (fail-open) و دسترسی همه را می‌داد. حالا `false` برمی‌گرداند (fail-closed)
    و `console.error` می‌زند. یک پارامتر اختیاری `{ failOpen: true }` برای
    backward compat اضافه شد.
  - `processPermission`/`processRole`: در directive، وقتی manager نبود به‌جای
    نمایش عنصر، آن را مخفی و fallback را نشان می‌دهد.

### 🟡 Medium

- **SEC-A6** (`@zenith/permission` — همان فایل):
  `any:`/`all:` prefix با permission names مثل `any:thing` (که به‌عنوان یک
  permission تک‌تکه خوانده می‌شد) collide می‌کرد. سینتکس جدید ترجیحی
  `any(...)` و `all(...)` (با پرانتز) اضافه شد. سینتکس قدیمی همچنان کار
  می‌کند اما فقط وقتی remainder شامل کاما باشد یا خودش شامل `:` نباشد، و
  یک `console.warn` deprecation می‌زند.

- **SEC-A7** (`@zenith/permission` — همان فایل):
  - متد `freeze()` اضافه شد — بعد از فراخوانی، `setUserAccess` و `clear`
    no-op می‌شوند و `console.error` می‌زنند. برای pin کردن state بعد از
    hydration تا XSS نتواند آن را mutate کند.
  - `console.info` در `createPermissionManager`: "Client-side permissions are
    for UI only — always enforce server-side."

- **SEC-A8** (`@zenith/auth` — `packages/auth/src/auth.ts` + `dist/auth.js`):
  default `tokenStorage` از `'localStorage'` به `'memory'` تغییر کرد. توضیحات
  کامل در JSDoc اضافه شد — localStorage در برابر XSS آسیب‌پذیر است چون هر
  script در صفحه می‌تواند token را بخواند.

- **SEC-A9** (`@zenith/auth` — همان فایل):
  به fetch logout، `keepalive: true` اضافه شد تا درخواست حتی بعد از بسته‌شدن
  tab به سرور برسد. در صورت fail شدن fetch (مثلاً AbortError هنگام unload)،
  fallback `navigator.sendBeacon` اجرا می‌شود.

- **SEC-A10** (`@zenith/expressions` — `packages/expressions/src/parser.ts` +
  `dist/parser.js`):
  depth counter و `MAX_DEPTH = 200` به کلاس Parser اضافه شد. در ورودی به
  `parsePrimary` (ورودی به هر سطح nesting)، depthincrement و چک می‌شود؛
  اگر از limit فراتر رود، خطای توصیفی پرتاب می‌شود. این کار از stack-overflow
  روی ورودی pathologically nested (مثل `(((((((...)))))))`) جلوگیری می‌کند.

- **SEC-A11** (`@zenith/form` — `packages/form/src/validator.ts` +
  `dist/validator.js`):
  در rule `pattern:`، طول ورودی قبل از regex test به ۱۰۰۰ کاراکتر cap می‌شود.
  این کار یک bound بالا روی backtrack time در صورت author شدن یک pattern
  pathologically slow (مثل `(a+)+`) می‌گذارد. کامنت توضیحی اضافه شد که
  `pattern:` فقط برای static developer-authored patterns است.

### 🟢 Low

- **SEC-A12** (`@zenith/permission` — `directive.ts` + `dist/directive.js`):
  `fallbackTemplate.innerHTML` قبل از assign به `fallbackEl.innerHTML` با
  `sanitizeHTML()` از `@zenith/security` پاکسازی می‌شود. اگر مهاجم بتواند یک
  `<template zen-fallback>` در صفحه تزریق کند، markup مخرب دیگر verbatim
  کپی نمی‌شود. import از `@zenith/security` circular dep ایجاد نمی‌کند چون
  security هیچ runtime import ندارد.

- **SEC-A13** (`@zenith/auth` — `auth.ts` + `dist/auth.js`، فقط مستندسازی):
  کامنت JSDoc جامع در `_storeTokens` اضافه شد که implications CSRF هر
  `tokenStorage` mode را توضیح می‌دهد:
  - `memory`: CSRF-proof (token روی cross-origin requestها ارسال نمی‌شود).
  - `localStorage`/`sessionStorage`: CSRF-proof اما XSS-vulnerable (SEC-A8).
  - `cookie` با `SameSite=Strict` (default): CSRF در سطح browser بلاک می‌شود.
    برای SameSite=Lax، باید server-side CSRF token اضافه شود.
  - همیشه `Origin`/`Referer` را روی state-changing endpoints چک کنید.

### Infrastructure

- تمام **۳۱** `packages/*/package.json` از `1.2.5` به `1.2.6` بامپ شدند.
- `packages/devtools-extension/manifest.json` از `1.2.5` به `1.2.6` بامپ شد.
- `index.html`: title به `v1.2.6`، هر ۳ download link به `zenith-v1.2.6.zip`.
- `mobile.html`: download link به `zenith-v1.2.6.zip` و متن به `v1.2.6`.
- `docs/CHANGELOG.md`: این بخش `## [1.2.6]` اضافه شد.
- `docs/README.md`: version badge به `1.2.6` (header + footer line).
- `docs/LLM-GUIDE.md`: `version`, `framework_version`, و footer line به `1.2.6`.
- ZIP `download/zenith-v1.2.6.zip` ساخته شد (`download/` و `node_modules/` مستثنی).

### Verification

- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/demos/router/index.html`
  → **HTTP 200**.
- هر ۱۳ رفع با کامنت `// SEC FIX (v1.2.6):` در src و dist مشخص شده است.

---

## [1.2.5] — ۲۰۲۶-۰۶-۲۶

### خلاصه

نسخه‌ی **hotfix** — رفع regression جدی در `@zenith/expressions` که در v1.2.4 معرفی شده بود.

### 🔴 REGRESSION FIX: Identifier resolution — prototype chain broken

**مشکل**: اصلاح BUG-E3 در v1.2.4 عملگر `in` را با `Object.prototype.hasOwnProperty.call()` جایگزین کرد. این کار prototype chain را نادیده گرفت و باعث شد متغیرهای parent context (مثل `$formatPrice`، `$toPersianNums`، helper functions) داخل `zen-for` در دسترس نباشند.

**تأثیر واقعی**: تمام expression‌هایی که به متغیرهای parent دسترسی داشتند (مثل `$formatPrice(p.price)` داخل `zen-for`) با خطای "متغیر تعریف نشده" شکست می‌خوردند. قیمت‌های محصول در فروشگاه خالی رندر می‌شدند.

**علت فنی**: `zen-for` یک child context با `Object.create(parentContext)` می‌سازد. متغیرهای parent از طریق prototype chain در دسترس هستند. اما `hasOwnProperty` فقط own properties را بررسی می‌کند و prototype chain را نادیده می‌گیرد:

```js
const parent = {};
Object.defineProperty(parent, '$formatPrice', { get: () => 'test' });
const child = Object.create(parent);

// v1.2.4 (BROKEN):
Object.prototype.hasOwnProperty.call(child, '$formatPrice'); // → false

// v1.2.5 (FIXED):
'$formatPrice' in child; // → true ✓
```

**رفع**: به عملگر `in` برگشتیم (prototype chain را پشتیبانی می‌کند) اما یک blocklist از `Object.prototype` built-in methods اضافه کردیم (`toString`, `hasOwnProperty`, `constructor`, `__proto__` و غیره). این built-in‌ها فقط اگر کاربر به‌صورت صریح آنها را به‌عنوان own property تعریف کرده باشد قابل دسترسی هستند.

```typescript
const OBJECT_PROTO_BUILTINS = new Set([
  'constructor', 'toString', 'hasOwnProperty', 'valueOf',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString',
  '__proto__', '__defineGetter__', '__defineSetter__',
  '__lookupGetter__', '__lookupSetter__',
]);
const isInContext = node.name in context;
const isOwnProp = Object.prototype.hasOwnProperty.call(context, node.name);
const isProtoBuiltin = OBJECT_PROTO_BUILTINS.has(node.name) && !isOwnProp;
if (!isInContext || isProtoBuiltin) {
  throw variableNotDefinedError(node.name, availableVars);
}
```

### 📦 فایل‌های تغییر‌یافته

- `packages/expressions/src/evaluator.ts` — Identifier resolution fix
- `packages/expressions/dist/evaluator.js` — نسخه‌ی کامپایل‌شده

### ✅ سازگاری

- prototype chain مجدداً کار می‌کند — متغیرهای parent در `zen-for`، `zen-if`، `zen-suspense` و سایر directive‌های structural در دسترس هستند.
- `Object.prototype` built-in methods مسدود شده‌اند (مگر اینکه کاربر صریحاً override کرده باشد).
- هیچ breaking change‌ای وجود ندارد.

---

## [1.2.4] — ۲۰۲۶-۰۶-۲۵

### خلاصه
نسخه‌ی **Patch** — سومین بسته از رفع باگ‌های audit (Batch 5). این نسخه ۹ رفع باگ متمرکز روی Core Engine در ۴ پکیج (runtime، state، expressions) ارائه می‌دهد. تمام رفع‌ها به‌صورت هم‌زمان در `src` و `dist` اعمال شده‌اند و با کامنت‌های `// FIX (v1.2.4):` مشخص شده‌اند.

### 🐛 رفع باگ‌ها (۹ مورد)

#### `@zenith/runtime` (۵ مورد)
- **IF-1**: `processIf` — `reportError(new Error('[zen-if] Using display:none fallback...'))` در بلوک `hasForChild` حذف شد. این مسیر یک fallback طبیعی و مورد انتظار است، نه یک error. `console.warn` بالای آن برای visibility کافی است؛ ارسال به error-boundary لاگ‌ها را آلوده می‌کرد.
- **BIND-1**: `processBind` — برای `value` یا `checked` روی عناصر فرم (`<input>`, `<textarea>`, `<select>`, `<option>`)، به‌جای `setAttribute` از property assignment مستقیم (`el[attrName] = ...`) استفاده می‌شود. این کار `.value`/`.checked` live را در sync نگه می‌دارد و کنترل controlled-input‌ها را ممکن می‌کند. این branch قبل از `BOOLEAN_ATTRIBUTES` اجرا می‌شود تا `checked` به مسیر property برسد.
- **BIND-2**: `processBind` — برای `class` با مقدار Array، اعضای array iterate می‌شوند و class‌ها add/remove می‌گردند. مثال: `zen-bind:class="['active', $hasError ? 'text-red' : '']"`. این branch قبل از object-class check اجرا می‌شود تا array‌ها به‌اشتباه به‌عنوان object رفتار نکنند.
- **TRACK-1**: `processTrack` — click handler به `() => setTimeout(() => fire(), 0)` تغییر یافت. این کار اجازه می‌دهد رویداد click ابتدا کاملاً dispatch شود قبل از اینکه analytics (که ممکن است work شبکه/XHR انجام دهد) اجرا شود — از تداخل با navigation یا تغییر state checkbox جلوگیری می‌کند.
- **TRACK-2**: `processTrack` — `WeakSet<HTMLElement>` به نام `seenVisibleElements` در module scope اضافه شد. در مسیر `visible`، اگر element قبلاً fire کرده باشد، دوباره fire نمی‌شود (de-duplication در re-hydration). در dispose، `seenVisibleElements.delete(el)` صدا زده می‌شود تا element بتواند در صورت re-attach دوباره fire کند.
- **ISLAND-1**: `processIsland` — validation صریح برای `hydrateMode`. اگر مقدار در `['visible','idle','load']` نباشد (مثلاً typo مثل `"visibe"` یا `"idll"`), یک `console.warn` چاپ می‌شود و mode به `'load'` default می‌شود. قبلاً هر مقدار نامعتبر بی‌صدا به `'load'` تبدیل می‌شد.
- **MEMO-1**: `processMemo` — در catch block بعد از `processChildren`، `childDisposes` clear می‌شود. اگر `processChildren` در وسط کار throw کند، array ممکن است شامل dispose functions ناقص برای children نیمه‌set-up باشد. صدا زدن آن‌ها بعداً می‌تواند خودش throw کند یا روی DOM در حالت ناسازگار عمل کند. Clear کردن اینجا تضمین می‌کند که run بعدی از حالت clean شروع می‌شود.

#### `@zenith/state` (۲ مورد)
- **EFFECT-1**: `effect` — در `runEffect`، یک `catch` block به try/finally اضافه شد. اگر `fn()` در وسط اجرا throw کند، cleanups که در طول اجرای ناقص ثبت شده‌اند (مثلاً `onCleanup` داخل effect body) اجرا و سپس clear می‌شوند، سپس error دوباره throw می‌شود. قبلاً این cleanups leaked می‌شدند — effect از reactive graph خارج می‌شد ولی cleanups هرگز اجرا نمی‌گشتند.
- **REGISTRY-1**: `clearRegistry` — `nextSignalId = 1` حذف شد (با کامنت توضیحی). Reset کردن این counter باعث ID collision می‌شود: signal‌های ساخته‌شده بعد از `clearRegistry()` (مثلاً بین test suite‌ها یا بعد از route change) ID‌های 1، 2، 3، ... را reuse می‌کردند که ممکن بود هنوز توسط timeline entries یا DevTools panel‌ها یا FinalizationRegistry callbacks ارجاع داده شوند. نگه داشتن counter به‌صورت monotonically increasing، یکتایی global ID را برای lifetime فرآیند تضمین می‌کند.

#### `@zenith/expressions` (۲ مورد)
- **EVAL-1**: `evaluate` — در `case 'Identifier'`، `!(node.name in context)` با `!Object.prototype.hasOwnProperty.call(context, node.name)` جایگزین شد. عملگر `in` زنجیره prototype را طی می‌کند، یعنی یک Identifier می‌توانست روی `Object.prototype` "پیدا" شود (مثل `constructor`، `toString`، `hasOwnProperty`، `__proto__`) وقتی context کاربر چنین own property‌ای ندارد. این به‌عنوان defense-in-depth در کنار `FORBIDDEN_PROPERTIES_RT` در `MemberExpression` عمل می‌کند: identifierها فقط از own context کاربر resolve می‌شوند.
- **LEX-1**: `lex` — `case 'u'` (خواندن ۴ hex digit) و `case 'x'` (خواندن ۲ hex digit) به escape switch اضافه شدند. حالا string literals از `\uXXXX` (Unicode code point) و `\xXX` (Latin-1 hex) پشتیبانی می‌کنند. مثال: `"\u0041"` → `"A"`, `"\x41"` → `"A"`, `"\x0A"` → `"\n"`. این پشتیبانی به‌طور هم‌زمان در regular string literals (`"..."`/`'...'`) و template literals (`` `...` ``) اضافه شده تا parity حفظ شود. در صورت malformed (مثلاً `\uXYZW` یا `\xG1`)، به default behavior قبلی برمی‌گردد (کاراکتر بعدی به‌صورت literal).

### 📦 زیرساخت
- همه‌ی ۳۱ `package.json` از `1.2.3` به `1.2.4` bump شدند.
- `packages/devtools-extension/manifest.json` به `1.2.4` bump شد.
- `index.html` title به `v1.2.4` و download links به `zenith-v1.2.4.zip` به‌روزرسانی شد.
- `mobile.html` download link و text به `v1.2.4`/`zenith-v1.2.4.zip` به‌روزرسانی شد.
- `docs/README.md` version badge به `1.2.4`.
- `docs/LLM-GUIDE.md` version و framework_version و footer به `1.2.4`.
- ZIP `zenith-v1.2.4.zip` ساخته شد.

### ✅ Verification
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/demos/router/index.html` → **HTTP 200**.
- `node --check` روی همه‌ی ۹ فایل dist اصلاح‌شده: همه OK.
- تمام ۹ رفع باگ با کامنت `// FIX (v1.2.4):` در src و dist مشخص شده‌اند.

---

## [1.2.3] — ۲۰۲۶-۰۶-۲۵

### خلاصه
نسخه‌ی **Patch** — دومین بسته از رفع باگ‌های audit (Batch 4). این نسخه ۱۸ رفع باگ در ۵ پکیج (permission، resource، router، i18n، security) ارائه می‌دهد. تمام رفع‌ها در `src` و `dist` اعمال شده‌اند و با کامنت‌های `// FIX (v1.2.3):` مشخص شده‌اند.

### 🐛 رفع باگ‌ها (۱۸ مورد)

#### `@zenith/permission` (۱ مورد)
- **PERM-1**: `processPermission` و `processRole` — جایگزینی `display:none` با DOM removal واقعی. قبلاً برای deny فقط `el.style.display = 'none'` ست می‌شد که عنصر را در DOM نگه می‌داشت (Effectها/Event Listenerهای داخلی همچنان فعال می‌ماندند). حالا children در یک `DocumentFragment` ذخیره و از DOM حذف می‌شوند، و هنگام grant از همان Fragment restore می‌شوند.

#### `@zenith/resource` (۵ مورد)
- **RES-1**: `createOptimistic` — اگر سرور ۲۰۴ (No Content) برگرداند (یعنی `result.data === undefined`)، tempId از لیست فیلتر می‌شود (به‌جای map کردن). قبلاً tempId در UI باقی می‌ماند.
- **RES-2**: `deleteOptimistic` — بعد از delete موفق با ۲۰۴، `isStale: true` ست می‌شود تا `list()` بعدی revalidate کند. قبلاً داده‌های stale به‌روزرسانی نمی‌شدند.
- **RES-3**: `startAutoRefresh` — `if (this._destroyed) return;` در ابتدای متد و داخل callback تایمر اضافه شد. قبلاً تایمر بعد از destroy هم ساخته می‌شد و روی signal تخریب‌شده می‌نوشت.
- **RES-4**: `_processQueue` — بعد از `const result = await item.op()`، اگر `result.success === false` باشد، rollback صدا زده می‌شود. قبلاً فقط در صورت throw rollback اتفاق می‌افتاد.
- **RES-5**: `_request` dedup — `cacheKey` شامل body می‌شود: `body ? \`${method}:${url}:${JSON.stringify(body)}\` : \`${method}:${url}\``. قبلاً POST با body‌های متفاوت به‌اشتباه dedup می‌شدند.

#### `@zenith/router` (۳ مورد)
- **ROUT-1**: `navigate()` — مسیر فعلی با `pathname + search + hash` مقایسه می‌شود (نه فقط pathname). قبلاً navigate به همان صفحه با query متفاوت skip می‌شد. همچنین clean path (split روی `?` و `#`) در `routeSignal` ذخیره می‌شود.
- **ROUT-2**: `popstateHandler` — شامل `search` و `hash` می‌شود، سپس clean می‌شود. قبلاً Back/Forward به همان صفحه با query متفاوت، `routeSignal` را آپدیت نمی‌کرد.
- **ROUT-3**: `outlet.ts` — `MAX_ROUTE_CACHE_SIZE = 50` اضافه شد. وقتی cache از ۵۰ entry بیشتر شود، قدیمی‌ترین entry (با کوچک‌ترین timestamp) evict می‌شود. قبلاً cache هیچ limit نداشت و در SPA با صفحات زیاد، حافظه بی‌نهایت مصرف می‌شد.

#### `@zenith/i18n` (۳ مورد)
- **I18N-1**: `addDaysJalali` — در branch غیر-string، `new Date(date)` به `date` تغییر کرد. قبلاً یک کپی غیرضروری ساخته می‌شد.
- **I18N-2**: `parseJalaliParts` — در صورت ورودی نامعتبر، `null` برمی‌گردد (نه `[0, 0, 0]`). return type به `[number, number, number] | null` تغییر کرد. `formatJalali` هم با `?? [0, 0, 0]` به‌روزرسانی شد.
- **I18N-3**: `isRTL` — سه منبع چک می‌شوند: `document.dir === 'rtl'`، `document.documentElement.dir === 'rtl'`، و `['fa','ar','he','ur'].includes(document.documentElement?.lang?.split('-')[0] || '')`. قبلاً فقط `document.dir === 'rtl'` چک می‌شد که در صفحه‌های با `<html lang="fa">` ولی بدون `dir` صریح، false برمی‌گشت.

#### `@zenith/security` (۵ مورد)
- **SEC-2**: `sanitizeHTML` و `sanitizeHTMLWithOptions` — SSR guard در ابتدای هر دو تابع اضافه شد: `if (typeof DOMParser === 'undefined') return '';`. قبلاً در Node.js بدون jsdom، `ReferenceError` پرتاب می‌کرد.
- **SEC-4**: `isAttributeDangerous` — `srcset`، `cite`، `poster`، `background` به لیست URL attributeها اضافه شدند (در کنار `href`، `src`، `action`، `formaction`، `xlink:href`، `data`). این attributeها هم می‌توانند حاوی URL با `javascript:` باشند.
- **SEC-5**: `data:image/` URLs برای `src` روی `<img>` و `<source>` مجاز شدند. قبلاً هر `data:` URL بلاک می‌شد و inline image‌های base64 از کار می‌افتادند. تابع کمکی `isDataImage` اضافه شد.
- **SEC-6**: `cleanNode` و `cleanNodeWithOptions` — بعد از پاکسازی children، اگر node یک `<template>` است، `node.content` هم به‌صورت بازگشتی پاکسازی می‌شود. قبلاً payload مخرب داخل `<template>` پنهان می‌شد و بعد از clone شدن اجرا می‌گشت.
- **SEC-7**: `sanitizeHTMLTrusted` به `src/sanitizer.ts` اضافه شد و از `src/index.ts` export شد. قبلاً فقط در `dist/sanitizer.js` و `dist/index.js` وجود داشت (یک drift بین src و dist). این تابع یک Identity Function است (ورودی را دست‌نخورده برمی‌گرداند) و به‌عنوان marker صریح برای محتوای Trusted استفاده می‌شود.

### 📦 زیرساخت
- همه‌ی ۳۱ `package.json` از `1.2.2` به `1.2.3` bump شدند.
- `packages/devtools-extension/manifest.json` به `1.2.3` bump شد.
- `index.html` title به `v1.2.3` و download links به `zenith-v1.2.3.zip` به‌روزرسانی شد.
- `mobile.html` download link به `zenith-v1.2.3.zip` به‌روزرسانی شد.
- `docs/README.md` version badge به `1.2.3`.
- `docs/LLM-GUIDE.md` version و framework_version به `1.2.3`.
- ZIP v1.2.3 ساخته شد.

### ✅ Verification
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/demos/router/index.html` → **HTTP 200**.
- `node --check` روی همه‌ی فایل‌های dist اصلاح‌شده: همه OK.
- تمام ۱۸ رفع باگ با کامنت `// FIX (v1.2.3):` در src و dist مشخص شده‌اند.

---

## [1.2.2] — ۲۰۲۶-۰۶-۲۵

### خلاصه
نسخه‌ی **Patch** — رفع ۲۲ باگ بحرانی، ۲ رفع امنیتی، و **بازیابی کامل قابلیت‌های v1.2.x** که به‌اشتباه توسط یک subagent قبلی حذف شده بودند. تمام رفع‌های باگ در `src` و `dist` موجود بودند؛ این نسخه فایل‌های حذف‌شده را برمی‌گرداند و نسخه‌ی همه‌ی پکیج‌ها را به 1.2.2 ارتقا می‌دهد.

### 🐛 رفع باگ‌های بحرانی (۲۲ مورد)

- **BUG-1**: `zen-error` dispatch — walker هیچ‌گاه `processErrorBoundary` را import نمی‌کرد، در نتیجه `zen-error` یک attribute مرده بود. اکنون به‌درستی dispatch می‌شود.
- **BUG-2**: zen-if parent of zen-for — fallback به `display:none` برای جلوگیری از context loss روی zen-for. همچنین nested levels هم array-aware هستند.
- **BUG-3**: zen-model `stopPropagation` غیرضروری حذف شد — باعث می‌شد رویداد به delegated listenerها نرسد.
- **BUG-4**: zen-if بررسی `zen-for` در nested levels — قبلاً فقط direct children بررسی می‌شدند. حالا با `querySelectorAll('[zen-for]')` کل زیردرخت بررسی می‌شود.
- **BUG-5**: i18n `formatJalali` — ترتیب replace اصلاح شد. قبلاً `MM` قبل از `MMMM` جایگزین می‌شد و نام ماه خراب می‌گشت. حالا `MMMM` اول جایگزین می‌شود.
- **BUG-6**: SSR hydration — `parts.pop()` و `parts.reverse()` غیرضروری حذف شدند (parts از قبل در ترتیب root-to-leaf هستند).
- **BUG-8**: SSR — قبلاً state با placeholder در head chunk emit می‌شد و سپس overwrite می‌گشت. اکنون placeholder و state جدا emit می‌شوند.
- **BUG-9**: SSR hydrate — type validation + prototype pollution protection. فقط عناصر جدید (not-yet-proxied) wrap می‌شوند.
- **BUG-10**: SSR `doc.body` null-check برای `<frameset>` — قبلاً crash می‌کرد.
- **BUG-11**: FormStore — `valid` از `newFields` محاسبه می‌شود، نه از `this._signal.get().fields` (stale data).
- **BUG-12**: Resource refresh race condition — `_refreshPromise` در پایان clear می‌شود. `_destroyed` flag اضافه شد؛ متدهای عمومی بعد از destroy no-op می‌شوند.
- **BUG-13**: walker — قبل از walk مجدد در زنجیره `zen-if`/`zen-else-if`/`zen-else`، attributeها حذف می‌شوند تا Effectهای duplicate ساخته نشوند.
- **BUG-15**: scheduler `afterFlush` — قبلاً از exports حذف شده بود (مرده). اکنون دوباره export می‌شود.
- **BUG-16**: scheduler hard kill — قبلاً فقط یک warning چاپ می‌شد و صف continue داشت (browser freeze). اکنون صف clear می‌شود.
- **BUG-17**: expressions `optional chaining` — در حالت `?.`، `optional: true` ست می‌شود تا short-circuit درست کار کند.
- **BUG-18**: expressions `FORBIDDEN_IDENTIFIERS` — قبلاً فقط `window`/`document`/`eval` چک می‌شد. حالا همه‌ی FORBIDDEN_IDENTIFIERS چک می‌شوند.
- **BUG-19**: components lazy loading — چک `src` قبل از چک `template` انجام می‌شود. اگر `src` وجود داشته باشد، async fetch می‌شود.
- **BUG-20**: compiler — directives جدید v1.2.x به `RUNTIME_DIRECTIVES` اضافه شدند.
- **BUG-22**: state `setEffectContextStore` — `activeEffect` از `_getMutableContext()` خوانده می‌شود تا context store درست propagate شود.

### 🔒 رفع امنیتی (۲ مورد)

- **SEC-1**: Auth — کوکی‌های سمت کلاینت اکنون `Secure` و `SameSite=Strict` دارند. قبلاً فقط `HttpOnly` بودند (در client-side قابل تنظیم نیست).
- **SEC-3**: SSR — `<` در hydration script escape می‌شود تا از XSS در زمان hydration جلوگیری شود.

### ✨ بازیابی قابلیت‌های v1.2.x (۱۱ فایل + به‌روزرسانی‌های walker/index)

یک subagent قبلی به‌اشتباه فایل‌های قابلیت v1.2.x را هنگام رفع باگ‌ها حذف کرد. در v1.2.2، **همه‌ی فایل‌ها به‌صورت کامل (src + dist) بازیابی شدند**:

#### دایرکتیوهای جدید runtime (۷ فایل، هر کدام src + dist):

- **`zen-memo`** (`processMemo`): زیردرخت را در یک Effect می‌پیچد که فقط زمانی که مقدار Expression تغییر کند (با `Object.is`) دوباره پردازش می‌شود.
- **`zen-island`** (`processIsland`): پردازش فرزندان را به تعویق می‌اندازد. سه حالت: `visible` (IntersectionObserver)، `idle` (requestIdleCallback)، `load` (immediate). Fallback chain: visible→idle→setTimeout. پشتیبانی از `<template slot="placeholder">`.
- **`zen-virtual`** (`processVirtualRepeat`): virtual scrolling برای لیست‌های بزرگ. تشخیص table mode (`<tr>`) vs generic. Per-item Signal (`itemSignal`, `indexSignal`) برای reactive updates. پشتیبانی از `zen-dynamic-heights` با ResizeObserver.
- **`zen-button`** (`processStatefulButton`): جایگزینی عنصر با `<button>` واقعی. State machine: idle/loading/success/error. `resetTimer` برای setTimeout cleanup. `injectDefaultStyles()` برای CSS (spinner، success green، error red، RTL support).
- **`zen-optimistic`** (`processOptimistic`): روی click، Expression مثبت را اعمال می‌کند، اکشن نام‌گذاری‌شده را await می‌کند، و در صورت خطا Expression rollback را اجرا می‌کند. Action با `{state, event, element}` context فراخوانی می‌شود.
- **`zen-track`** (`processTrack`): analytics tracking. فرمت `"trigger:eventName"` (trigger = click | visible). `configureAnalytics` برای تنظیم handler.
- **`zen-date-picker`** (`processDatePicker`): custom element با `customElements.define`. استفاده از `toJalali`, `fromJalali`, `jalaliMonthDays`, `jalaliMonthName` از `@zenith/i18n`. RTL grid با month nav و day selection. رویداد `change` با Jalali `YYYY/MM/DD`.

#### Hydration Engine (runtime، ۱ فایل src + dist):

- **`hydrate.ts`**: شامل `createHydrator`, `hydrateText`, `hydrateTextExpr`, `hydrateHtml`, `hydrateHtmlExpr`, `hydrateHtmlTrusted`, `hydrateShow`, `hydrateShowExpr`, `hydrateIf`, `hydrateBind`, `hydrateBindExpr`, `hydrateModel`, `hasHydrationMarkers`, `countHydrationMarkers`, و `Hydrator` interface. Effectها را به عناصر SSR-rendered متصل می‌کند بدون بازسازی آنها (no flicker).

#### Async Component Loader (components، ۱ فایل src + dist):

- **`async-loader.ts`**: شامل `loadComponent`, `processAsyncComponent`, `clearComponentCache`, `configureComponentCache`. `escapeHTML` برای XSS safety. SSR guards. TTL+maxSize cache با `CacheEntry`.

#### Timing Modifiers (events، ۱ فایل src + dist):

- **`timing-modifiers.ts`**: `applyTimingModifiers` برای پشتیبانی از `.debounce.NNN` و `.throttle.NNN`. تابع برگشتی `.cancel()` برای teardown دارد.

#### به‌روزرسانی‌های walker و index:

- **walker.ts + walker.js**: importها و dispatch blockها برای همه‌ی دایرکتیوهای v1.2.x اضافه شد:
  - `zen-memo` (بعد از zen-error، قبل از custom directives)
  - `zen-island` (قبل از custom directives)
  - `zen-virtual` (قبل از zen-for، چک برای هر دو zen-for و zen-virtual)
  - `zen-button` (قبل از custom directives)
  - `zen-optimistic` (در processNodeDirectives)
  - `zen-track` (در processNodeDirectives)
  - `zen-date-picker` (چک tagName === 'zen-date-picker')
- **runtime/index.ts + index.js**: export همه‌ی APIهای v1.2.x اضافه شد.
- **events/index.ts + index.js**: export `applyTimingModifiers` اضافه شد.
- **components/index.ts + index.js**: export async-loader APIها اضافه شد.

### 📦 زیرساخت

- همه‌ی ۳۰ `package.json` از نسخه‌ی فعلی به `1.2.2` bump شدند.
- `packages/devtools-extension/manifest.json` به `1.2.2` bump شد.
- `index.html` download link به `zenith-v1.2.2.zip` به‌روزرسانی شد.
- `mobile.html` download link به `zenith-v1.2.2.zip` به‌روزرسانی شد.
- ZIP v1.2.2 ساخته شد.

---

## [1.0.0] — ۲۰۲۶-۰۶-۲۲

### خلاصه
نسخه‌ی **Major** — بهینه‌سازی‌های性能 v1.0. شش بهینه‌سازی بحرانی برای Hot Path ها، رفع دو باگ مهم، و یک رابط API جدید.

### 🚀 بهینه‌سازی‌های性能 (۶ مورد)

- **Expression Compile-Once API** (`compileExpression`): تابع جدید در `@zenith/expressions` که AST را یک‌بار parse می‌کند و یک closure `(ctx) => any` برمی‌گرداند. در هر re-runِ Effect، فقط `evaluate(ast, ctx)` اجرا می‌شود — صفر Map operation (نه `cache.has/get/delete/set` LRU touch). تمام directive processor ها (text, bind, if, show, html, html-trusted, model, for, intersection, resource, fetch, components, virtual-list) به این API مهاجرت کردند.
- **Property Diffing در zen-bind**: اگر مقدار Expression با قبلی `===` برابر باشد، `setAttribute` صدا زده نمی‌شود. این برای primitives دقیق است و برای objects (class object) از reference comparison استفاده می‌کند. همچنین در show, html, html-trusted, model اعمال شد.
- **zen-for Fast Path** (`zen-static` attribute): attribute جدید `zen-static` روی `<li zen-for="..." zen-key="..." zen-static>` فعال می‌شود. در این حالت:
  - per-item `signal(item)` + `signal(i)` ساخته نمی‌شود (۲ signal کمتر per item).
  - `createStaticLoopContext` (مقادیر مستقیم) به جای `createLoopContext` (getter + signalsMap).
  - در تغییر لیست: full re-render به جای keyed diffing.
  - مناسب برای لیست‌های ایستا (منوها، جدول‌های read-only، نتایج جستجوی static).
- **DocumentFragment Batching**: در initial mountِ zen-for (هم standard و هم static)، همه‌ی نودهای جدید در یک DocumentFragment جمع می‌شوند و یک‌بار `insertBefore` می‌شوند. این کار DOM reflow را از N به ۱ کاهش می‌دهد.
- **Compiler Walker Elimination Level 3**: compiled module دیگر برای هر عنصر runtime directive، `Zen.start` صدا نمی‌زند (که باعث duplicate Event Delegation listeners می‌شد). حالا یک‌بار `Zen.start` روی dummy div برای setup یک‌بار، سپس `walkAndBind` برای هر عنصر (سبک‌وزن‌تر، بدون re-init).
- **DevTools Disable Option**: `Zen.start(root, state, { devtools: false })` — وقتی `devtools: false`، `initDevTools` صدا زده نمی‌شود و `window.__ZENITH__` تنظیم نمی‌شود. `__trackDirective` به no-op تبدیل می‌شود. در benchmark و production پیشنهاد می‌شود.

### 🐛 رفع باگ‌های بحرانی (۲ مورد)

- **SSR Race Condition (100 concurrent requests)**: `renderToString` قبلاً `globalThis` را برای نصب `window`, `document`, `Node`, etc. از JSDOM mutate می‌کرد. در ۱۰۰ درخواست concurrent، این race condition داشت. حالا از `AsyncLocalStorage` برای isolation per-request استفاده می‌کند. Getter های `globalThis` فقط در Node.js نصب می‌شوند (در browser دست نمی‌زنیم) و به AsyncLocalStorage storedelegate می‌کنند. فایل جدید: `packages/ssr/src/dom-context.ts`.
- **Benchmark 100x Gap**: zen-if mount (118ms for 10k) vs zen-text mount (13924ms) — ۱۰۰x اختلاف. علت: DevTools tracking (که در `Zen.start` به‌صورت پیش‌فرض فعال بود) برای zen-text صدا زده می‌شد اما نه برای zen-if. با LRU eviction (MAX_NODES_PER_TYPE=500)، ۱۰k عنصر باعث thrashing می‌شد. Fix: `devtools: false` option + unified benchmark scenarios (همه N=10k، `<div>`، DevTools OFF).

### 🔧 API های جدید

- `compileExpression(expr: string): (ctx: object) => any` — در `@zenith/expressions`.
- `Resource.destroy(): void` — در `@zenith/resource`. پاکسازی کامل: stopAutoRefresh، AbortController.abort (لغو in-flight fetch)، clear inflightRequests، clear mutationQueue، set `_destroyed`، reset signal، remove from registry. همه‌ی CRUD methods (`list/read/create/update/delete`) بعد از destroy `success: false` برمی‌گردانند.
- `Zen.start(root, state, options?: { devtools?: boolean })` — پارامتر سوم اختیاری.
- `zen-static` attribute — روی `<li zen-for>` برای فعال‌کردن fast path.
- `domAls`, `getDOMGlobals`, `installDOMGlobalGetters`, `DOMGlobals` — در `@zenith/ssr` (AsyncLocalStorage-based DOM isolation).

### 📊 Benchmark

- Benchmark scenarios unified: همه N=10k، `<div>`، `devtools: false`.
- benchmark جدید: `7b. zen-for zen-static` — speedup ratio vs standard.
- header: `v1.0.0 — REAL DOM (DevTools OFF)`.

### 📦 زیرساخت
- ۳۰ فایل package.json از `0.6.3` به `1.0.0` bump شدند.
- ۱۳ فایل directive processor (src + dist) به compileExpression مهاجرت کردند.
- ۲ فایل جدید: `packages/ssr/src/dom-context.ts` + dist.

### 🔧 بهبود Error Messages (P1-5)

- **پکیج جدید `@zenith/errors`** — کتابخانه‌ی پیام‌های خطای ساختاریافته با کدهای منظم (ZEN-001 تا ZEN-999).
- **۳۴ کد خطا** در ۱۰ دسته: Expression، Runtime، Resource، SSR، Security، Compiler، Router، Form، Component، Internal.
- **Typo detection** با Levenshtein distance.
- **۴۲ تست** برای کتابخانه‌ی خطاها.

### 🛠️ DevTools Extension v1.0.0 (P1-6)

- **تب جدید "⚡ v1.0"** در popup با ۴ بخش: zen-static badge، Resource.destroy status، cache stats، SSR stores.
- **۱۰ متد جدید** در DevTools hook.

### 🧪 Integration Tests برای Compiler (P1-7)

- **۴۷ تست E2E** برای compiler — Level 3 Walker Elimination verify شد.

### 🔄 Suspense Directive — کامل‌سازی (P2-8)

- **Complete rewrite** از `@zenith/suspense`: fallback/timeout/error slots + SuspenseContext + zen-fetch integration.
- **۲۲ تست** — همه pass.

### 📝 Form Validation — تکمیل (P2-9)

- **Async validators با AbortSignal**، **Nested validation**، **Cross-field validation**، **Lifecycle hooks**.
- New rules: `nationalId`، `persianPhone`، `differentFrom`، `requiresField`.
- **۴۳ تست** — همه pass.

### 🐛 رفع باگ‌های بحرانی (v1.0.1)

- **BUG-01**: leaveTransition memory leak هنگام toggle سریع — cancel function.
- **BUG-02**: zen-if parent of zen-for — fallback به display:none.
- **BUG-03**: FormStore async timer leak — destroy() method.
- **BUG-04**: zen-model nested $index resolution.
- **BUG-05**: leaveTransition transitionend listener leak on Zen.stop.
- **BUG-08**: zen-for indexKeysSeen dead code حذف شد.
- **BUG-09**: SSR hydrate type validation + prototype pollution protection.
- **IMPROVEMENT-04**: afterFlush() hook در scheduler.

### 🐛 رفع باگ‌های مهم (v1.0.1 — ادامه)

- **BUG-06**: Auth SSR — `_getStorage()` اکنون `__zenithSSR__` flag را چک می‌کند تا JSDOM در SSR به‌اشتباه localStorage را فعال نکند.
- **BUG-07**: i18n `toJalali()` — warning برای تاریخ‌های قبل از ۱۶۰۰ میلادی + validation خروجی اضافه شد.

### 🔵 بهبودها (v1.0.1)

- **IMPROVEMENT-01**: `??` (Nullish Coalescing) — از قبل پشتیبانی می‌شد (تایید شد).
- **IMPROVEMENT-02**: i18n API کامل تقویم جلالی — توابع جدید:
  - `fromJalali(jy, jm, jd)` — تبدیل جلالی به میلادی.
  - `parseJalaliParts(date)` — استخراج (سال، ماه، روز) جلالی.
  - `compareJalali(a, b)` — مقایسه دو تاریخ جلالی.
  - `addDaysJalali(date, days)` — جمع روز.
  - `isJalaliLeap(jy)` — بررسی کبیسه بودن.
  - `jalaliMonthDays(jy, jm)` — تعداد روزهای ماه.
  - `formatJalali(date, fmt)` — فرمت قابل تنظیم (YYYY/MM/DD/MMMM).
  - `jalaliMonthName(jm)` — نام ماه.
- **IMPROVEMENT-03**: virtual-list empty/loading slots — `<template slot="empty">` و `<template slot="loading">`.
- **IMPROVEMENT-05**: `zen-else` و `zen-else-if` — پردازش زنجیره if-else-if-else در walker. اولین branch با condition=true نمایش داده می‌شود.
- **IMPROVEMENT-06**: VS Code Extension DevTools — WebView Panel با آمار فریم‌ورک (signals، effects، directives، cache ratio، SSR stores) + status bar button.

### 📦 زیرساخت (نهایی)

- پکیج جدید: `@zenith/errors`.
- پکیج @zenith/suspense کامل‌سازی شد.
- پکیج @zenith/form enhancement شد (nested، cross-field، lifecycle، async + AbortSignal).
- پکیج @zenith/i18n enhancement شد (8 تابع جدید جلالی).
- پکیج @zenith/virtual-list enhancement شد (empty/loading slots).
- DevTools Extension به 1.0.0 به‌روزرسانی شد.
- VS Code Extension به‌روزرسانی شد (DevTools WebView Panel + status bar).
- ۱۴ باگ‌فیکس اعمال شد (BUG-01 تا BUG-09 + IMPROVEMENT-01 تا 06).
- **مجموع تست‌ها**: ۹۸ unit + ۹۵۰ security + ۴۷ compiler + ۴۲ errors + ۲۲ suspense + ۴۳ form = **۱۲۰۲ تست**.
---

## [0.6.3] — ۲۰۲۶-۰۶-۲۱

### خلاصه
نسخه‌ی **Patch** — رفع ۹ باگ از audit مستقل کاربر. تمام رفع‌ها در **هر دو** مسیر `sources/*.ts` و `packages/dist/*.js` اعمال شدند.

### 🐛 رفع باگ‌های بحرانی (۶ مورد)
- **zen-bind compiler**: attributeهای غیر boolean (src/href/value) اکنون درست compile می‌شوند (BOOLEAN_ATTRS list).
- **FormStore.moveItem()**: `Array.isArray` قبل از spread چک می‌شود (crash روی undefined برطرف شد).
- **Vite plugin**: `d.fullMatch.trim()` → `d.name` (runtime directive matching درست شد).
- **FOUC**: `processDOM` در `try/finally` قرار گرفت (صفحه سفید در صورت خطا برطرف شد).
- **zen-action-button**: `textContent` با `cloneNode` جایگزین شد (آیکون‌ها و HTML داخلی حفظ می‌شوند).
- **resource-view**: `zen-key` attribute اکنون با `evaluateExpression` ارزیابی می‌شود (نه فقط فیلد `id`).

### 🐛 رفع باگ‌های مهم (۳ مورد)
- **zen-model**: `stopPropagation` فقط با `zen-stop-propagation="true"` فعال می‌شود.
- **Stateful directives** در `RUNTIME_DIRECTIVES` compiler اضافه شدند.
- **Security**: `doc.body` null check برای `<frameset>`.

### 📦 زیرساخت
- `src/*.ts` به مسیر `sources/` منتقل شد — `packages/` فقط شامل `dist/*.js` است.
- Changelog section از index.html حذف شد، دکمه «دریافت پروژه» به hero اضافه شد.

---

## [0.6.2] — ۲۰۲۶-۰۶-۲۱

### رفع ۶ باگ از audit v0.6.0
- zen-bind compiler bug (boolean vs non-boolean attributes)
- FormStore.moveItem() crash
- Vite plugin runtime directive mismatch
- zen-action-button textContent inner HTML را نابود می‌کرد
- Route matching trailing slash normalization
- zen-model stopPropagation غیرضروری

---

## [0.6.1] — ۲۰۲۶-۰۶-۲۰

### رفع باگ 404 در دموی روتر SPA
- `src` در `<zen-route>` به مسیر مطلق تغییر شد.
- `Zen.navigate('/')` در init به `routeSignal.set` تغییر شد (بدون pushState).

### رفع باگ‌های امنیتی در @zenith/stateful
- `new Function()` در resource-view → `evaluateExpression` (sandbox-safe).
- `innerHTML` در action-button → `cloneNode` (XSS-safe).

### رفع باگ‌های FOUC
- `try/finally` اطراف `processDOM`.
- `opacity:0` روی root به‌جای `visibility:hidden` selector.

### رفع باگ‌های کیفیت
- stateful `src/` فایل‌ها ایجاد شد.
- `clearCurrentSlot` همیشه `clearKeyedItems` را صدا می‌زند.
- Stateful directives در `RUNTIME_DIRECTIVES` اضافه شد.
- `zen-cloak` به `COMPILABLE_DIRECTIVES` منتقل شد.

---

## [0.6.0] — ۲۰۲۶-۰۶-۲۰

### خلاصه

نسخه‌ی **Stateful Components + FOUC Fix + Lazy Loading Fix** — رفع باگ Lazy Component Loading (dead code)، افزودن پیشگیری از FOUC (auto-cloak)، و معرفی ۳ کامپوننت Stateful که بزرگ‌ترین درخواست کاربر را برآورده می‌کنند: مدیریت خودکار loading/error/empty/success/retry بدون ترکیب دستی zen-if/zen-bind.

### 🐛 رفع باگ: Lazy Component Loading (dead code)

- **`@zenith/components` index.ts**: باگ واقعی کشف‌شده توسط کاربر. `if(!template){return}` قبل از `if(lazySrc&&!template)` بود → lazy loading هرگز اجرا نمی‌شد (dead code).
- **رفع**: منطق بازنویسی شد. اولویت با inline template است؛ اگر نبود و `src` بود، lazy fetch انجام می‌شود. `<zen-component name="x" src="/components/x.html">` اکنون واقعاً کار می‌کند.

### 🎨 پیشگیری از FOUC (Flash of Unstyled Content)

- **`Zen.cloakCSS()`** — متد جدید که CSS مخفی‌کننده‌ی عناصر پردازش‌نشده را برمی‌گرداند.
- **Auto-cloak در `Zen.start`**: قبل از `processDOM`، یک `<style id="zenith-cloak-style">` با `[zen-if],[zen-for],...{visibility:hidden!important}` به `<head>` تزریق می‌شود. بعد از `processDOM` (synchronous)، حذف می‌شود.
- **دو لایه دفاع**: (۱) کاربر می‌تواند `<style>${Zen.cloakCSS()}</style>` را در HTML inline کند (pre-paint)، (۲) `Zen.start` به‌صورت خودکار safety net تزریق می‌کند.
- از `visibility:hidden` (نه `display:none`) استفاده می‌کند تا layout حفظ شود.

### 🏗️ Stateful Components (بزرگ‌ترین درخواست کاربر)

پکیج جدید **`@zenith/stateful`** با ۳ کامپوننت Stateful که مدیریت خودکار وضعیت‌ها را بدون ترکیب دستی directiveها فراهم می‌کنند:

#### `<zen-resource-view>` — مدیریت خودکار loading/error/empty/success/retry
- **config**: `$resourceVarName` (یک Resource از `createResource`).
- ۴ slot خودکار: loading (spinner)، error (پیام + دکمه retry)، empty (موردی یافت نشد)، success (zen-for روی `resource.data` با template کاربر).
- کاربر فقط template محتوا را می‌دهد:
```html
<zen-resource-view config="$usersResource">
  <template>
    <div zen-text="$item.name"></div>
  </template>
</zen-resource-view>
```
- effect روی `resource.signal` → swap خودکار slot‌ها. retry → `resource.list(true)`.

#### `<zen-action-button>` — حالت loading روی async actions
- **action**: نام action (مثل `zen-action`).
- **loading-text**: متن حالت loading.
- وقتی کلیک می‌شود و action یک Promise برمی‌گرداند: button غیرفعال + کلاس `zen-action-loading` + نمایش loading-text تا زمان resolve/reject.
```html
<zen-action-button action="save" loading-text="در حال ذخیره...">ذخیره</zen-action-button>
```

#### `<zen-auth-view>` — نمایش خودکار بر اساس authentication
- **config**: `$authVarName` (auth signal).
- دو `<template slot="authenticated">` و `<template slot="guest">`.
- effect روی `auth.signal` → `isAuthenticated`决定 کدام template رندر شود.
```html
<zen-auth-view config="$auth">
  <template slot="authenticated">خوش آمدید!</template>
  <template slot="guest">لطفاً وارد شوید</template>
</zen-auth-view>
```

#### نصب
```ts
import { ZenithStatefulPlugin } from '@zenith/stateful';
Zen.use(ZenithStatefulPlugin);
// یا:
import { installStatefulComponents } from '@zenith/stateful';
installStatefulComponents();
```

### 🛠️ زیرساخت

- تمام ۳۱ فایل `package.json` + benchmarks از `0.5.0` به `0.6.0` بومپ شدند.
- پکیج جدید `@zenith/stateful` به monorepo اضافه شد (اکنون ۳۱ پکیج).
- `Zen.cloakCSS()` و `registerCustomDirective()` به `@zenith/runtime` export شدند.
- `processResourceView`، `processActionButton`، `processAuthView` از `@zenith/stateful` export شدند.

---

## [0.5.0] — ۲۰۲۶-۰۶-۲۰

### خلاصه

نسخه‌ی **Security Hardening + Directives Expansion** — رفع ۳ باگ بحرانی امنیتی (از جمله یک sandbox escape واقعی دیگر)، رفع ۷ باگ در service-worker/devtools/ssr، و افزودن ۶ قابلیت جدید شامل ۵ directive جدید و یک استراتژی cache جدید.

### 🛡️ اصلاحات امنیتی بحرانی (۳ مورد)

#### بحرانی · sandbox escape با bracket notation و key متغیر
- **`@zenith/expressions` evaluator.ts**: runtime guard اضافه شد. `FORBIDDEN_PROPERTIES_RT = ['constructor','__proto__','prototype','__defineGetter__','__defineSetter__']` در `MemberExpression` case چک می‌شود. حالا `$obj[$key]` وقتی `$key='constructor'` باشد هم block می‌شود (قبلاً فقط literal `'constructor'` block می‌شد).
- ۶ تست fuzzing جدید اضافه شد. مجموع: **۱۰۴۴ تست** (۱۰۳۸ + ۶ جدید). همه pass.
- این دومین sandbox escape واقعی است که fuzzing suite کشف کرده (اولی در v0.4.0 بود).

#### بحرانی · XSS در devtools-extension — icons وجود نداشتند
- `manifest.json` و `background.js` به فایل‌های `icons/` ارجاع می‌دادند که وجود نداشتند → Chrome extension load نمی‌شد.
- ارجاعات icon حذف شدند (Chrome از default icon استفاده می‌کند). extension اکنون تمیز load می‌شود.
- **Graph Viewer tab** در popup اضافه شد — دکمه‌ی «📊 Graph» که گراف وابستگی‌ها را در یک تب جدید باز می‌کند.

#### بحرانی · staleWhileRevalidate برای POST — cache.match ممکن بود hit کند
- **`@zenith/service-worker` strategies.ts**: guard `if (request.method !== 'GET' && request.method !== 'HEAD') return fetch(request)` به ابتدای `cacheFirst`، `networkFirst`، و `staleWhileRevalidate` اضافه شد. mutationها اکنون همیشه مستقیم به network می‌روند.

### 🔧 @zenith/service-worker — ۳ رفع دیگر

#### بالا · Background Sync Queue در IndexedDB persist شد
- قبلاً `_queue` یک آرایه‌ی in-memory بود → SW restart = از دست رفتن mutations. اکنون در IndexedDB (DB `zenith-sw-sync`، store `mutations`) persist می‌شود. `loadQueue()`، `saveQueue()`، `addToQueue()`، `removeFromQueue()` اضافه شد.

#### متوسط · Exponential backoff با jitter
- retry ثابت ۳ بار → `retryWithBackoff` با `baseDelay=1000`، `maxDelay=30000`، `delay = min(baseDelay * 2^attempt, maxDelay)`، `jitter = delay * 0.2 * Math.random()`.

#### متوسط · SSR guard در registerSW
- `if (typeof window === 'undefined') return` و `if (!('serviceWorker' in navigator))` guard ها اضافه شد. پکیج اکنون در Node.js/SSR crash نمی‌کند.

### 🔧 @zenith/devtools — ۲ رفع

#### متوسط · Graph Viewer در extension popup ادغام شد
- تب پنجم «📊 Graph» در popup اضافه شد. `loadGraph()` با `chrome.scripting.executeScript` گراف زنده را از صفحه می‌گیرد و در `graph-viewer.html` باز می‌کند.

#### پایین · DependencyGraph max-node limit
- `MAX_NODES_PER_TYPE = 500` اضافه شد. در `addSignal`/`addEffect`/`addDirective`/`addDom`، اگر تعداد node‌های آن نوع به ۵۰۰ برسد، قدیمی‌ترین (LRU) evict می‌شود. جلوگیری از پر شدن حافظه DevTools در اپ‌های بزرگ.

### 🔧 @zenith/ssr — ۱ رفع

#### متوسط · Nested Server Components پشتیبانی می‌شود
- `inlineServerComponents` اکنون loop اجرا می‌کند (MAX_PASSES=10) تا زمانی که هیچ `<zen-server-component>` باقی نمانده. اگر خروجی یک Server Component خودش شامل Server Component باشد، رندر می‌شود.

### ✨ قابلیت‌های جدید (۶ مورد)

#### ★★★★★ zen-portal directive (رندر به خارج از hierarchy)
- **`@zenith/runtime` directives/portal.ts**: `<div zen-portal="#modals" zen-if="$isOpen">` عنصر را به container مشخص‌شده (fallback `body`) منتقل می‌کند در حالی که reactivity حفظ می‌ماند. dispose عنصر را به جایگاه اصلی برمی‌گرداند.
- کاربرد: Modal/Tooltip که نباید توسط `overflow:hidden` والد بریده شود.

#### ★★★★☆ zen-animate directive (Web Animations API)
- **`@zenith/transition` animate.ts**: `<div zen-animate="slideUp">` یا `<div zen-animate="bounce,duration:500,easing:ease-in">`.
- ۱۱ preset: fadeIn, fadeOut, slideUp, slideDown, slideLeft, slideRight, scaleIn, scaleOut, bounce, shake, rotate.
- `parseAnimateAttr(value)` → `{ preset, keyframes, options }`. SSR-safe.

#### ★★★★☆ cache-then-network استراتژی (استراتژی ششم SW)
- **`@zenith/service-worker` strategies.ts**: ابتدا cache را ارائه می‌دهد (سریع)، در پس‌زمینه network را چک می‌کند، اگر update بود `onUpdate(fresh)` callback را فراخوانی می‌کند تا UI refresh شود. مناسب فیدهای خبری و قیمت‌ها.

#### ★★★☆☆ zen-intersection directive (IntersectionObserver)
- **`@zenith/runtime` directives/intersection.ts**: `<div zen-intersection="$loadMore()">` — وقتی عنصر وارد viewport شود، callback ارزیابی می‌شود. مناسب lazy loading و infinite scroll.

#### ★★★☆☆ zen-cloak directive (جلوگیری از FOUC)
- **`@zenith/runtime` directives/cloak.ts**: `<div zen-cloak>` با CSS `[zen-cloak] { display: none; }` عنصر را تا زمان mount مخفی می‌کند. سپس `zen-cloak` attribute حذف می‌شود.

#### ★★☆☆☆ zen-ref directive (reference مستقیم به DOM)
- **`@zenith/runtime` directives/ref.ts**: `<input zen-ref="myInput">` یک Signal را با ارجاع مستقیم به DOM element پر می‌کند. برای مواردی که نیاز به imperative DOM access دارید.

### 🛠️ زیرساخت

- تمام ۳۰ فایل `package.json` + benchmarks از `0.4.0` به `0.5.0` بومپ شدند.
- ۵ directive جدید به walker و compiler RUNTIME_DIRECTIVES اضافه شدند (zen-portal, zen-animate, zen-intersection, zen-cloak, zen-ref).
- `cacheThenNetwork` به `CacheStrategyName` union اضافه شد.
- `zenAnimate`، `ANIMATE_PRESETS`، `parseAnimateAttr`، `processAnimate` از `@zenith/transition` export شدند.
- `processPortal`، `processIntersection`، `processCloak`، `processRef` از `@zenith/runtime` export شدند.

---

## [0.4.0] — ۲۰۲۶-۰۶-۲۰

### خلاصه

نسخه‌ی **Roadmap Completion Release** — پیاده‌سازی تمام ۷ مورد باقی‌مانده از Roadmap v0.3.0. این نسخه شامل یک **اصلاح امنیتی بحرانی** (کشف و رفع یک sandbox escape واقعی توسط Fuzzing Suite) است.

### 🔍 DevTools Graph Viewer (★★★★★)

- **`@zenith/devtools` اکنون Dependency Graph را نمایش می‌دهد**: Signal → Effect → Directive → DOM.
- فایل جدید `devtools/src/graph.ts` با کلاس `DependencyGraph` (nodes: Signal/Effect/Directive/DOM، edges: read-by/drives/updates).
- یک **visual viewer** مستقل: `devtools/dist/graph-viewer.html` — گراف تعاملی SVG با force-directed layout، click-to-highlight، drag nodes، dark theme، Persian labels.
- ادغام zero-cost با runtime walker: hookهای `__trackDirective` که فقط وقتی DevTools فعال است اجرا می‌شوند (no-op در production).
- `window.__ZENITH__.getDependencyGraph()` برای دسترسی زنده.

### 📊 Benchmark Suite (★★★★☆)

- پوشه‌ی جدید `benchmarks/` با ۴ دسته benchmark:
  - **List Rendering**: zen-for vs manual DOM (۱k, ۱۰k, ۱۰۰k items)
  - **Signal Updates**: ۱۰k sequential updates + ۱k×۱۰ bulk updates
  - **Nested Reactivity**: ۳-level zen-for (۱۰۰×۱۰×۱۰ = ۱۰k leaf nodes) — کمی‌سازی "Nested Reactivity Explosion"
  - **Signal vs Computed micro-benchmarks**: get/set throughput, computed re-eval, effect re-run
- اجرا با `node benchmarks/src/run-all.js` — گزارش فرمت‌شده با ops/sec.

### 🌐 Service Worker — Offline-first (★★★★☆)

- **پکیج جدید `@zenith/service-worker`** با ۵ استراتژی cache:
  - `cacheFirst`, `networkFirst`, `staleWhileRevalidate`, `networkOnly`, `cacheOnly`
- SW bootstrap: install (precache)، activate (cleanup)، fetch (route matching)، sync (background sync for failed mutations).
- Main-thread API: `registerSW`, `unregisterSW`, `updateSW` + `ZenithSWPlugin` برای `Zen.use(zenithSWPlugin, config)`.
- ادغام با `@zenith/resource`: فیلد `swCacheName` به `ResourceConfig` اضافه شد.

### 🔒 zen-html-trusted (★★★★☆)

- **دو API مجزا**: `zen-html` (همیشه sanitized) و `zen-html-trusted` (developer آگاهانه opt-in می‌کند).
- `sanitizeHTMLTrusted()` در `@zenith/security` — identity function با **`console.warn` در dev mode** برای visibility.
- `processHtmlTrusted` در `@zenith/runtime` + ثبت در walker (priority: zen-html-trusted > zen-html > zen-text).
- پشتیبانی کامل در compiler: `zen-html-trusted` در `COMPILABLE_DIRECTIVES`، render signature به ۸ پارامتر گسترش یافت.

### 🛡️ Expression Sandbox Fuzzing (★★★★☆) — **کشف و رفع sandbox escape واقعی!**

- فایل `expressions/test/test-fuzzing.ts` + `.js` با **۱۰۳۸ تست case** در ۶ دسته:
  - Prototype Pollution، Constructor-based escapes، Function/eval escapes، Global access، Encoded/obfuscated، **Random fuzzing (۱۰۰۰ seeded expressions)**.
- **🚨 کشف واقعی**: Fuzzer پیدا کرد که توکن مستقل `constructor` (نه فقط `$obj.constructor`) سازنده‌ی `Object` را برمی‌گرداند، چون `in` operator روی prototype chain راه می‌رود. این یک **sandbox escape واقعی** بود.
- **رفع**: `constructor`, `__proto__`, `prototype` به `FORBIDDEN_IDENTIFIERS` در `validator.ts` اضافه شدند. بعد از رفع، همه‌ی ۱۰۳۸ تست pass می‌شوند.

### 🖥️ Server Components (★★★☆☆)

- **`<zen-server-component>`** در `@zenith/ssr` — رندر کاملاً سمت سرور، zero client JS برای آن subtree.
- `defineServerComponent(name, render)`, `registerServerComponent`, `renderServerComponent`, `inlineServerComponents`.
- SSR pre-pass: `<zen-server-component>` tags را پیدا کرده، render کرده، و با marker comments جایگزین می‌کند.
- Hydrate skip: `skipServerComponents()` با `TreeWalker` تمام `zen-*` attributes داخل marker region را strip می‌کند → no effects → no client JS.
- **مزیت بزرگ نسبت به React**: HTML-First architecture این قابلیت را طبیعی می‌کند.

### 🧹 dispose zen-for child effects (★★★☆☆ — رفع محدودیت v0.3.0)

- **`walkAndBind(root, state)`** به `@zenith/runtime` اضافه شد — sibling سبک‌ترِ `processDOM` که event delegation را re-init نمی‌کند و teardown برمی‌گرداند.
- Compiler-generated zen-for اکنون `processChildren(clone, ctx)` را صدا زده و dispose function را ذخیره می‌کند؛ هنگام حذف آیتم، `dispose()` فراخوانی می‌شود → **memory leak برطرف شد**.
- `@zenith/vite-plugin` از `walkAndBind` برای `processChildren` استفاده می‌کند (با fallback به `Zen.start` برای backward-compat).
- Parity tests به‌روزرسانی شد تا dispose handling را assertion کنند.

### 🛠️ زیرساخت

- تمام ۲۹ فایل `package.json` + benchmarks از `0.3.0` به `0.4.0` بومپ شدند.
- پکیج جدید `@zenith/service-worker` به monorepo اضافه شد (اکنون ۳۰ پکیج).
- `sanitizeHTMLTrusted` از `@zenith/security` export شد.
- `processHtmlTrusted` از `@zenith/runtime` export شد.
- `walkAndBind` از `@zenith/runtime` export شد.
- `DependencyGraph`, `graph`, `getDependencyGraph` از `@zenith/devtools` export شدند.
- `ServerComponent`, `registerServerComponent`, `defineServerComponent`, `renderServerComponent`, `inlineServerComponents` از `@zenith/ssr` export شدند.

### 🗺️ Roadmap — تکمیل‌شده

تمام ۷ مورد Roadmap v0.3.0 در این نسخه پیاده‌سازی شدند. Roadmap جدید برای نسخه‌های بعدی:

| اولویت | قابلیت | وضعیت |
|--------|--------|-------|
| ★★★☆☆ | zen-crud demo page (نمایش کامل CRUD Engine) | Roadmap |
| ★★★☆☆ | CSS استاندارد برای zen-crud tables | Roadmap |
| ★★★☆☆ | DevTools Chrome Extension panel برای Graph Viewer | Roadmap |
| ★★☆☆☆ | CLI `zenith bench` command | Roadmap |
| ★★☆☆☆ | Multi-tab routing در DevTools | Roadmap |

---

## [0.3.0] — ۲۰۲۶-۰۶-۲۰

### خلاصه

نسخه‌ی **Feature Release** — پیاده‌سازی ۶ قابلیت بزرگ بر اساس گزارش معماری v0.2.0. این نسخه بزرگ‌ترین ریسک شناسایی‌شده (پیچیده شدن Core) را با معرفی **Plugin Architecture** برطرف می‌کند و به‌سوی «۱۰۰٪ Compileable Templates» حرکت می‌کند.

### 🧩 Plugin Architecture (★★★★★ — بزرگ‌ترین ریسک برطرف شد)

- **`Zen.use(plugin, options)`** API به `@zenith/runtime` اضافه شد.
- یک Plugin شیءای با `name` و `install(zen, options)` است. `Zen.use` آن را یک‌بار فراخوانی می‌کند و در registry ثبت می‌کند (نصب مجدد no-op + warning).
- `Zen.plugins()` لیست پلاگین‌های نصب‌شده را برمی‌گرداند (برای DevTools).
- **هدف**: نگه‌داشتنِ Core Runtime کوچک. قابلیت‌هایی مثل auth، resource، crud، i18n اکنون می‌توانند به‌صورت Plugin نصب شوند به‌جای وارد شدن به Core.
- پشتیبانی از chaining: `Zen.use(a).use(b)`.

### 🔧 Full Compile Pipeline (★★★★★)

- **`zen-for` اکنون کاملاً compilable است.** از `RUNTIME_DIRECTIVES` به `COMPILABLE_DIRECTIVES` منتقل شد.
- کد تولیدشده برای zen-for: یک `effect` با keyed diffing (clone template، insertBefore/removeChild، Map بر اساس key)، با پشتیبانی از `processChildren` برای پردازش فرزندان هر آیتم.
- امضای `render()` به ۷ پارامتر گسترش یافت: `render(root, ctx, effect, signal, sanitizeHTML, state, processChildren)`.
- `@zenith/vite-plugin` همیشه `Zen` را import می‌کند و یک `processChildren` به render پاس می‌دهد.
- **نتیجه**: هر ۷ directive اصلی (zen-text, zen-if, zen-show, zen-bind, zen-html, zen-model, zen-for) اکنون compilable هستند — هزینه‌ی runtime DOM walk discovery حذف می‌شود.
- محدودیت‌های شناخته‌شده (roadmap): dispose کردن effectهای فرزندان zen-for هنگام حذف آیتم، و استفاده از `Zen.start` per-clone (که event delegation را دوباره ثبت می‌کند).

### 🧪 Runtime/Compiler Parity Tests (★★★★★)

- فایل `packages/compiler/test/test-parity.ts` اضافه شد.
- برای هر ۷ directive قابل‌compile بررسی می‌کند که: (۱) کد کامپایل‌شده الگوهای صحیح را تولید می‌کند، (۲) directive در `runtimeDirectives` نیست (یعنی کامپایل شده نه fallback)، (۳) رفع‌های امنیتی v0.2.0 (sanitizeHTML در zen-html، state.set در zen-model) در خروجی حضور دارند، (۴) امضای render تمام ۷ پارامتر را دارد.
- این تست‌ها از «دو موتور همزمان» (رفتار متفاوت dev/prod) جلوگیری می‌کنند.

### 💾 Resource Persistence — IndexedDB (★★★★☆)

- **`@zenith/resource` اکنون از IndexedDB persistence پشتیبانی می‌کند** (مشابه TanStack Persist Query).
- فایل جدید `packages/resource/src/persistence.ts` با کلاس `IndexedDBCache` (lazy open، SSR-safe، resilient).
- `ResourceConfig` با فیلدهای `persist`، `persistStore`، `persistTtl`، `persistKey` گسترش یافت.
- متدهای `restoreFromCache()` و `persistToCache()` به کلاس `Resource` اضافه شد.
- الگو: constructor در صورت `persist:true` به‌صورت fire-and-forget `restoreFromCache()` را فراخوانی می‌کند (cache قبل از اولین request شبکه نمایش داده می‌شود، سپس SWR revalidate می‌کند). بعد از هر request موفق، `persistToCache()` اجرا می‌شود.
- **Offline-first**: داده‌ها در page reload از cache نمایش داده می‌شوند.

### 🏗️ HTML CRUD Engine — `zen-crud` (★★★★★ — بزرگ‌ترین مزیت تجاری)

- فایل جدید `packages/crud/src/crud-engine.ts` با کلاس `CrudEngine` و تابع `processCrud`.
- یک directive `zen-crud` که از یک config (JSON یا `$variable`) یک جدول CRUD کامل با **Pagination، Filters، Search، Sort، Row Actions، Table Actions، و Permission checks** تولید می‌کند.
- state داخلی reactive: `searchQuery`، `currentPage`، `pageSize`، `activeFilters`، `sortBy`، `sortDir` + computed‌های `viewData`، `totalItems`، `totalPages`.
- pipeline: `filter → search → sort → paginate`.
- Actions داینامیک با namespacing (`__crud_<resource>_<kind>_<name>`)، با `confirm()` برای danger actions و `zen-permission` integration.
- **مثال**: `<div zen-crud="$userCrudConfig"></div>` یک جدول کامل با search/pagination/sort/delete تولید می‌کند.

### 🔍 LSP "Did you mean" Type Checking (★★★★★)

- `@zenith/vscode-extension` اکنون پیشنهاد تصحیح typo می‌دهد.
- وقتی کاربر `<span zen-text="$user.nmae">` می‌نویسد، diagnostic: `Property "nmae" not found on $user. Did you mean: $user.name?`
- پیاده‌سازی: تابع `levenshtein`، `collectKnownSignals` (اسکن `<script>` و فایل‌های companion `.ts`/`.js` برای state definitions + nested objects)، `checkSignalPropertyAccess` با threshold ≤ ۲.
- **CodeAction (Quick Fix)**: `Ctrl+.` پیشنهاد `Replace with $user.name` را می‌دهد که typo را مستقیماً تصحیح می‌کند.
- cache per-document version (re-scan on save).

### 🛠️ زیرساخت

- تمام ۲۹ فایل `package.json` از `0.2.0` به `0.3.0` بومپ شدند.
- `ZenithPlugin` interface از `@zenith/runtime` export شد.
- `IndexedDBCache` و `dbCache` از `@zenith/resource` export شدند.
- `CrudEngine` و `processCrud` از `@zenith/crud` export شدند.
- این CHANGELOG به‌روزرسانی شد.

### 🗺️ Roadmap (نسخه‌های بعدی)

موارد شناسایی‌شده در گزارش معماری که در نسخه‌های بعدی پیاده‌سازی می‌شوند:

| اولویت | قابلیت | وضعیت در ۰.۳.۰ |
|--------|--------|----------------|
| ★★★★★ | DevTools Graph Viewer (Signal → Effect → Directive → DOM) | Roadmap |
| ★★★★☆ | Benchmark Suite رسمی (100k items, 10k updates, nested reactivity) | Roadmap |
| ★★★★☆ | Offline-first Resources (Service Worker + cache strategies) | Partial (IndexedDB persistence) |
| ★★★★☆ | zen-html-trusted API (آگاهانه انتخاب محتوای trusted) | Roadmap |
| ★★★★☆ | Expression Sandbox Fuzzing (constructor, __proto__, prototype) | Roadmap |
| ★★★☆☆ | Server Components (`<zen-server-component>`) | Roadmap |
| ★★★☆☆ | dispose کردن effectهای فرزندان zen-for هنگام حذف آیتم | Roadmap (v0.3.0 limitation) |

---

## [0.2.0] — ۲۰۲۶-۰۶-۲۰

### خلاصه

نسخه‌ی **Maintenance & Bug Fix** — رفع ۱۴ باگ در ۹ پکیج، از جمله ۲ باگ بحرانی امنیتی و ۵ باگ بحرانی بصری در transitionها. هیچ breaking change‌ای در API عمومی وجود ندارد؛ تمام رفع‌ها سازگار با عقب هستند.

### 🔧 @zenith/transition — ۵ باگ رفع شد

#### بحرانی · بصری
- **رفع پرش اندازه قبل از شروع انیمیشن (Flash of Full Size)** در `runtime/src/directives/if.ts`.
  ترتیب عملیات اصلاح شد: کلاس‌های `zen-enter-from` + `zen-enter-active` + name حالا **قبل** از `insertBefore()` ست می‌شوند تا اولین paint مرورگر حالت "from" باشد، نه حالت نهایی.

- **رفع Race condition در toggle سریع** در `runtime/src/directives/if.ts`.
  متغیر `isLeaving` اضافه شد. شاخه enter هنگام `(!isMounted || isLeaving)` اجرا می‌شود، `cancelTransition(el)` را برای لغو leave در حال انجام فراخوانی می‌کند، و callback خروج با `if (!isLeaving) return` محافظت می‌شود. قبلاً fast toggle (true → false → true در کمتر از duration) باعث می‌شد callback قدیمی leave عنصر mount‌شده را حذف کند.

#### بالا · بصری
- **رفع Single rAF** در `transition/src/transition.ts`.
  `enterTransition` و `leaveTransition` حالا از **double `requestAnimationFrame`** + **force reflow** (`getBoundingClientRect()`) استفاده می‌کنند تا اطمینان حاصل شود مرورگر حداقل یک paint برای حالت اولیه داشته باشد. در Chrome ۱۱۸+ و Firefox اخیر، single rAF می‌توانست from و to را در یک paint cycle ادغام کند.

#### بالا · UX
- **رفع setTimeout به‌جای transitionend** در `transition/src/transition.ts`.
  تشخیص پایان انیمیشن حالا با رویداد `transitionend` (دقیق) + `setTimeout` fallback در `duration + 50ms` انجام می‌شود. قبلاً اگر کاربر در CSS `transition: opacity 0.5s` نوشته اما پارامتر duration را ندهد (پیش‌فرض ۳۰۰ms)، کلاس‌ها ۲۰۰ms قبل از اتمام انیمیشن پاک می‌شدند.

#### متوسط · بصری
- **افزودن zen-for transition support** در `runtime/src/directives/for.ts`.
  آیتم‌های جدید در `zen-for` حالا enter animation و آیتم‌های حذف‌شده leave animation دارند (اگر `zen-transition` روی عنصر باشد). قبلاً آیتم‌های لیست ناگهانی ظاهر/مخفی می‌شدند. الگوی pre-DOM class setting (مانند `if.ts`) رعایت می‌شود.

### 🔧 @zenith/compiler — ۲ باگ رفع شد

#### بحرانی · امنیتی
- **رفع zen-html در کد کامپایل‌شده بدون sanitization (XSS در production)** در `compiler/src/compiler.ts`.
  کد تولیدشده برای `zen-html` حالا `el.innerHTML = sanitizeHTML(String(v))` تولید می‌کند. `sanitizeHTML` به‌عنوان پارامتر پنجم `render()` پاس داده می‌شود. قبلاً کد `el.innerHTML = String(v)` تولید می‌شد که در production build (بدون runtime walker) XSS-vulnerable بود.

#### بحرانی
- **رفع zen-model در کد کامپایل‌شده: ctx.$field = val Signal را آپدیت نمی‌کرد** در `compiler/src/compiler.ts`.
  `render()` حالا `state` (آبجکت خام شامل خود Signalها) را به‌عنوان پارامتر ششم می‌گیرد. کد تولیدشده برای `zen-model` از `state[fieldName].set(e.target.value)` استفاده می‌کند. قبلاً `ctx.$fieldName = e.target.value` تولید می‌شد که روی getter-only property silently fail می‌شد و two-way binding در صفحات کامپایل‌شده از کار می‌افتاد. `@zenith/vite-plugin` نیز به‌روزرسانی شد تا `window.__ZENITH_STATE__` را به render پاس دهد.

### 🔒 @zenith/security — ۲ باگ رفع شد

#### متوسط
- **رفع Crash با ورودی `<frameset>`** در `security/src/sanitizer.ts`.
  `doc.body` می‌تواند null باشد وقتی HTML با `<frameset>` جایگزین body شود. null-check اضافه شد: اگر body نبود، `cleanNode` روی `documentElement` اجرا می‌شود. هر دو تابع `sanitizeHTML` و `sanitizeHTMLWithOptions` اصلاح شدند.

#### پایین
- **رفع vbscript: بدون url() نادیده گرفته می‌شد** در `security/src/sanitizer.ts`.
  شرط `includes('url(') && includes('vbscript:')` به `includes('vbscript:')` مستقل تغییر کرد. قبلاً `style="vbscript:..."` بدون `url(` فیلتر نمی‌شد.

### 📝 @zenith/form — ۲ باگ رفع شد

#### پایین
- **رفع Warning نویز async-only rules** در `form/src/validator.ts`.
  `validateField` حالا `asyncRules.has(name)` را قبل از چاپ "Unknown validation rule" چک می‌کند. قبلاً برای هر async rule (مثل uniqueness check از سرور) یک warning نویز چاپ می‌شد.

#### متوسط
- **رفع بدون type coercion برای input type=number** در `form/src/validator.ts`.
  قوانین `min` و `max` حالا string‌های عددی (مثل "25" از input[type=number]) را به Number تبدیل و عددی مقایسه می‌کنند. قبلاً طول string چک می‌شد، پس `min:18` روی "25" طول ۲ را چک می‌کرد نه عدد ۲۵.

### 🖱️ @zenith/events — ۲ باگ رفع شد

#### متوسط
- **پیاده‌سازی Modifier های .self و .once** در `events/src/modifiers.ts` + `delegation.ts`.
  - `.self`: اکشن فقط وقتی `event.target === element` اجرا می‌شود. `applyBehaviorModifiers` حالا `element` می‌گیرد و boolean برمی‌گرداند.
  - `.once`: اکشن فقط یک‌بار اجرا می‌شود. بعد از اولین اجرای موفق، attribute `zen-action` از عنصر حذف می‌شود.

#### پایین
- **رفع focus/blur قابل delegate نیستند** در `events/src/modifiers.ts`.
  `focusin` و `focusout` (که bubble می‌شوند، برخلاف focus/blur) به `DELEGATED_EVENTS` اضافه شدند. کاربر می‌نویسد: `<input zen-action:focusin="onFocus" zen-action:focusout="onBlur">`.

### 🏪 @zenith/store — ۱ باگ رفع شد

#### متوسط · TypeScript
- **رفع TypeScript type ادعا می‌کرد getter مقدار unwrapped برمی‌گرداند، runtime یک Computed object می‌داد** در `store/src/store.ts`.
  تعریف type برای getters در `StoreContext` و `Store` از `R` (unwrapped) به `Computed<R>` تغییر کرد تا با runtime مطابقت داشته باشد. قبلاً TypeScript فکر می‌کرد `store.fullName` یک string است، اما runtime یک Computed object بود و باید `store.fullName.get()` فراخوانی می‌شد. این تناقض type/runtime باعث می‌شد کد type-safe بنویسیم اما runtime خطا بدهد. رفتار runtime ثابت ماند (`store.<getter>.get()`)، پس تست‌های موجود همچنان پاس می‌شوند.

### 🛠️ زیرساخت

- تمام ۲۹ فایل `package.json` (ریزه + ۲۸ پکیج) از نسخه `0.1.0` به `0.2.0` بومپ شدند.
- تمام ارجاعات داخلی `@zenith/*` در dependencies/devDependencies به `0.2.0` به‌روزرسانی شدند.
- این `CHANGELOG.md` اضافه شد.
- `README.md` و `LLM-GUIDE.md` با نسخه جدید و خلاصه‌ی changelog به‌روزرسانی شدند.
- `examples/index.html` (لندینگ‌پیج) با بخش Changelog، نسخه‌ی جدید در badgeها و لینک دانلود ZIP جدید به‌روزرسانی شد.

---

## [0.1.0] — ۲۰۲۶-۰۶-۱۹

### خلاصه

نسخه‌ی اولیه‌ی عمومی (Initial Public Release). ۲۹ پکیج، ۱۰۴۷ تست، ۱۸ directive، پشتیبانی از SSR، PWA، DevTools، و RTL/Persian-first.

### ویژگی‌های کلیدی نسخه‌ی اولیه

- **HTML-First** — منطق با directiveهای `zen-*` در HTML.
- **Signal-based Reactivity** — Fine-grained reactivity بدون Virtual DOM.
- **Expression Engine امن** — Lexer/Parser/Evaluator بدون `eval()`.
- **Automatic Batching** — Scheduler مبتنی بر Microtask با Priority Queue.
- **RTL & Persian-first** — اعداد فارسی، تاریخ شمسی، فرمت قیمت تومان.
- **TypeScript Strict** — strict mode کامل در همه‌ی ۲۹ پکیج.
- **PWA Ready** — `zenith create my-app --pwa`.
- **SSR** — رندر سمت سرور با Streaming و Hydration.
- **DevTools** — Chrome Extension با ۴ پنل.

### پکیج‌های منتشرشده

- **Core Engine**: `@zenith/state`, `@zenith/expressions`, `@zenith/scheduler`, `@zenith/runtime`
- **DOM Directives**: `@zenith/events`, `@zenith/components`, `@zenith/transition`, `@zenith/error-boundary`, `@zenith/suspense`, `@zenith/actions`
- **Routing & Data**: `@zenith/router`, `@zenith/data`, `@zenith/resource`, `@zenith/crud`, `@zenith/virtual-list`
- **Business Runtime**: `@zenith/form`, `@zenith/store`, `@zenith/auth`, `@zenith/permission`, `@zenith/i18n`
- **Security**: `@zenith/security`
- **Build & Tooling**: `@zenith/compiler`, `@zenith/vite-plugin`, `@zenith/cli`, `@zenith/ssr`, `@zenith/devtools`, `@zenith/vscode-extension`, `@zenith/dependency-graph`

---

## رابطه‌ی نسخه‌ها

| نسخه | نوع | توضیح |
|------|-----|-------|
| 1.4.0 | Major Audit Fixes | رفع ۱۵۶+ باگ و ۷۰+ بهبود در تمام ۳۱ پکیج |
| 1.3.0 | Minor Release | ۵ قابلیت جدید API + ۶ قابلیت Core Engine |
| 1.2.0 | Language Pack | i18n کامل + ۸ باگ‌فیکس + form-storage |
| 1.1.0 | Compiler & Routing | Compiler Level 2 + Router Lazy Loading + Error Messages |
| 1.0.0 | Performance + Completeness | ۶ بهینه‌سازی، Suspense کامل، Form Validation کامل |
| 0.6.0 | Feature Release | Transition WAAPI + Scheduler Priority + Virtual List Dynamic |
| 0.5.0 | RTK Release | DevTools v1.0 + Store API + Zen.use Plugin |
| 0.4.0 | Roadmap Completion | DevTools Graph + Benchmark + Service Worker + Fuzzing |
| 0.3.0 | Feature Release | Plugin Architecture + Full Compile + CRUD Engine + LSP |
| 0.2.0 | Maintenance & Bug Fix | رفع ۱۴ باگ در ۹ پکیج (۲ بحرانی امنیتی، ۵ بحرانی بصری) |
