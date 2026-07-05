# Zenith Framework — LLM Developer Guide

> **AI Skill: zenith-app-builder** — Build reactive web applications with the Zenith HTML-First framework.

## Skill Metadata

```yaml
name: zenith-app-builder
version: 1.4.0
description: Build reactive SPA applications using the Zenith HTML-First framework
language: TypeScript / HTML
framework_version: v1.4.0
packages: 32
tests: 1202
fuzz_tests: 1911
directives: 24
stateful_components: 3
strict_mode: true
production_ready: true
audit_tests: 950
unit_tests_v1: 98
```

---

## Quick Reference for LLMs

When a user asks to build a web app, SPA, or reactive UI:

1. **Check if Zenith is appropriate**: If the user wants a reactive, HTML-first, no-build-step framework → use Zenith.
2. **Architecture**: HTML defines structure with `zen-*` directives; TypeScript defines State (signals) and Actions.
3. **No JSX, no virtual DOM**: Direct DOM manipulation with fine-grained reactivity.
4. **Expression syntax**: Use `$variableName` for state access in HTML attributes. Use `'string' + $var` for concatenation (template literals with `${}` are NOT supported for interpolation).
5. **Always use `$` prefix** in expressions: `$user.name`, `$count`, `$route.params.id`.

---

## What's New in v0.2.0 (Maintenance & Bug Fix)

This release fixes **14 bugs across 9 packages**. No breaking API changes — all fixes are backward-compatible. Key changes LLMs should be aware of:

### Transition behavior is now correct
- `zen-if` + `zen-transition`: enter classes (`zen-enter-from`, `zen-enter-active`) are set **before** the element is inserted into the DOM, so the first paint shows the "from" state (no flash of full size).
- Fast toggling (show → hide → show within the transition duration) is now safe: the leave callback won't remove a re-mounted element.
- `enterTransition`/`leaveTransition` use **double `requestAnimationFrame`** + **force reflow** (`getBoundingClientRect()`) + **`transitionend` event** (with `setTimeout` fallback) for precise timing.
- `zen-for` now supports `zen-transition` — new list items get enter animation, removed items get leave animation.

### Compiled zen-html is now XSS-safe
- The compiler-generated code for `zen-html` now calls `sanitizeHTML(String(v))` before `innerHTML`. Previously, `el.innerHTML = String(v)` was generated, which was XSS-vulnerable in production builds (without the runtime walker).

### Compiled zen-model now works (two-way binding fixed)
- `render()` signature is now: `render(root, ctx, effect, signal, sanitizeHTML, state)` — the 6th param `state` is the raw state object containing the Signal instances.
- The compiled `zen-model` code uses `state[fieldName].set(e.target.value)` instead of `ctx.$fieldName = e.target.value` (which silently failed because `ctx.$fieldName` is a getter-only property).
- `@zenith/vite-plugin` passes `window.__ZENITH_STATE__` as the 6th arg to `render()`.

### Sanitizer is frameset-safe
- `sanitizeHTML()` and `sanitizeHTMLWithOptions()` now handle the case where `doc.body` is `null` (which happens when HTML contains `<frameset>`). Previously this caused a TypeError.
- The `vbscript:` protocol is now filtered independently in `style` attributes (previously only filtered when `url(` was also present).

### Form validation improvements
- `min`/`max` rules now coerce numeric strings to `Number` — `min:18` on an input value of `"25"` (a string from `input[type=number]`) now checks `25 >= 18`, not `"25".length >= 18`.
- `validateField()` no longer prints "Unknown validation rule" warnings for async rules (registered via `defineAsyncRule`).

### Event modifiers .self and .once now implemented
- `.self`: action only fires when `event.target === element` (useful for clicks on a container that should ignore bubbled clicks from children).
- `.once`: action fires only once; the `zen-action` attribute is removed from the element after the first execution.
- `focusin` and `focusout` (which bubble, unlike `focus`/`blur`) are now in `DELEGATED_EVENTS` — use `zen-action:focusin="onFocus"`.

### Store getter TypeScript type fixed
- `store.<getter>` is typed as `Computed<R>` (not `R`), matching runtime behavior. Access the value with `store.<getter>.get()`. This was already the runtime behavior; only the TypeScript type was incorrect.

See [CHANGELOG.md](./CHANGELOG.md) for the full list of fixes.

---

## What's New in v0.3.0 (Feature Release)

This release adds **6 major features** based on the v0.2.0 architecture review. Key changes LLMs should be aware of:

### Plugin Architecture — `Zen.use(plugin)`
- Core Runtime now has a plugin system to stay small. Capabilities like auth, resource, crud, i18n can be installed as plugins instead of being baked into Core.
- API: `Zen.use(plugin, options)` where `plugin = { name: string, install(zen, options) => void }`. Install runs once; re-installing the same name is a no-op. Supports chaining: `Zen.use(a).use(b)`.
- `Zen.plugins()` returns the list of installed plugin names (for DevTools).
- `ZenithPlugin` interface is exported from `@zenith/runtime`.

### Full Compile Pipeline — zen-for is now compilable
- `zen-for` moved from `RUNTIME_DIRECTIVES` to `COMPILABLE_DIRECTIVES`. All 7 core directives (zen-text, zen-if, zen-show, zen-bind, zen-html, zen-model, zen-for) are now compilable — eliminating runtime DOM walk discovery cost.
- `render()` signature is now: `render(root, ctx, effect, signal, sanitizeHTML, state, processChildren)` — the 7th param `processChildren` is used by compiled zen-for to process each cloned item's children.
- `@zenith/vite-plugin` always imports `Zen` and passes a `processChildren` function to `render()`.
- Known limitation (roadmap): child effects from `processChildren` (Zen.start per clone) are not disposed on item removal.

### Runtime/Compiler Parity Tests
- `packages/compiler/test/test-parity.ts` asserts that each compilable directive produces correct compiled code and is NOT in `runtimeDirectives` (no silent fallback). This prevents the "two engines, different dev/prod behavior" risk.

### Resource Persistence — IndexedDB (offline-first)
- `@zenith/resource` now supports IndexedDB-backed cache persistence (like TanStack Persist Query).
- New file `resource/src/persistence.ts` with `IndexedDBCache` class (lazy open, SSR-safe, resilient) and `dbCache` singleton.
- `ResourceConfig` extended with `persist`, `persistStore`, `persistTtl`, `persistKey`.
- `Resource` class has new `restoreFromCache()` and `persistToCache()` methods. On `persist:true`, the constructor fire-and-forget restores cache (shows cached data before first network request, then SWR revalidates). After each successful request, data is persisted.

### HTML CRUD Engine — `zen-crud` directive
- New `crud/src/crud-engine.ts` with `CrudEngine` class and `processCrud` function.
- `<div zen-crud="$configVar"></div>` generates a full CRUD table with Pagination, Filters, Search, Sort, Row Actions, Table Actions, and Permission checks — all from a single config object.
- Config: `CrudEngineConfig` with `resource`, `columns`, `searchFields`, `filters`, `pageSize`, `searchable`, `rowActions`, `tableActions`, `permission`.
- Internal reactive state: `searchQuery`, `currentPage`, `activeFilters`, `sortBy`, `sortDir` + computed `viewData`. Pipeline: `filter → search → sort → paginate`.

### LSP "Did you mean" Type Checking
- `@zenith/vscode-extension` now detects typos in `$variable.property` expressions and suggests the closest match.
- Example: `<span zen-text="$user.nmae">` → diagnostic: `Property "nmae" not found on $user. Did you mean: $user.name?`
- A CodeAction Quick Fix (`Ctrl+.`) offers `Replace with $user.name` to fix the typo directly.
- Signal collection scans inline `<script>` blocks and companion `.ts`/`.js` files for state object definitions (including nested objects).

### Roadmap (next versions)
- zen-crud demo page (full CRUD Engine showcase) — ★★★☆☆
- DevTools Chrome Extension panel for Graph Viewer — ★★★☆☆
- CLI `zenith bench` command — ★★☆☆☆

---

## What's New in v0.4.0 (Roadmap Completion)

This release implements **all 7 remaining roadmap items** from v0.3.0, plus discovers and fixes a **real sandbox escape**.

### DevTools Graph Viewer — Signal → Effect → Directive → DOM
- `@zenith/devtools` now exposes a `DependencyGraph` (`getDependencyGraph()` on `window.__ZENITH__`).
- A standalone visual viewer: `devtools/dist/graph-viewer.html` — interactive SVG with force-directed layout, click-to-highlight, drag nodes, dark theme, Persian labels.
- Zero-cost runtime integration: walker hooks (`__trackDirective`) are no-ops when DevTools is off.

### Benchmark Suite
- New `benchmarks/` folder with 4 categories: List Rendering (zen-for vs manual, up to 100k), Signal Updates (10k sequential + bulk), Nested Reactivity (3-level, 10k leaf nodes — quantifies "Nested Reactivity Explosion"), micro-benchmarks (get/set/computed/effect throughput).
- Run with `node benchmarks/src/run-all.js`.

### Service Worker — Offline-first (new `@zenith/service-worker` package)
- 5 cache strategies: `cacheFirst`, `networkFirst`, `staleWhileRevalidate`, `networkOnly`, `cacheOnly`.
- SW bootstrap (install/activate/fetch/sync), background sync for failed mutations.
- `ZenithSWPlugin` for `Zen.use(zenithSWPlugin, config)`.
- `ResourceConfig` extended with `swCacheName`.

### zen-html-trusted — explicit trusted content
- Two separate APIs: `zen-html` (always sanitized) and `zen-html-trusted` (developer opts in to bypass).
- `sanitizeHTMLTrusted()` is an identity function with a **dev-mode `console.warn`** for visibility/auditability.
- `processHtmlTrusted` directive processor in runtime, wired in walker with priority: zen-html-trusted > zen-html > zen-text.
- Fully compilable in compiler (render signature now 8 params).

### Expression Sandbox Fuzzing — **found and fixed a real escape!**
- New `expressions/test/test-fuzzing.ts` with **1038 test cases** in 6 categories + 1000 seeded random expressions.
- **🚨 Real discovery**: the fuzzer found that a standalone `constructor` token (not just `$obj.constructor`) returned the `Object` constructor, because the `in` operator walks the prototype chain. This was a genuine sandbox escape.
- **Fix**: `constructor`, `__proto__`, `prototype` added to `FORBIDDEN_IDENTIFIERS` in `validator.ts`. All 1038 tests now pass.

### Server Components — `<zen-server-component>`
- `@zenith/ssr` now supports Server Components: render entirely on the server, zero client JS for that subtree.
- `defineServerComponent(name, render)`, `registerServerComponent`, `inlineServerComponents` (SSR pre-pass), `skipServerComponents` (hydrate skip via TreeWalker stripping zen-* attrs inside marker region).
- Big advantage over React: HTML-First architecture makes this natural.

### dispose zen-for child effects — memory leak fix
- New `walkAndBind(root, state)` export from `@zenith/runtime` — a lightweight sibling of `processDOM` that returns a teardown function without re-initializing event delegation.
- Compiler-generated zen-for now captures the dispose function from `processChildren` and calls it on item removal → the v0.3.0 memory leak is fixed.
- `@zenith/vite-plugin` uses `walkAndBind` for `processChildren` (with fallback to `Zen.start` for backward-compat).

---

## What's New in v1.0.0 (Performance Optimizations)

v1.0.0 یک **major release** است با تمرکز بر بهینه‌سازی performance. ۶ بهینه‌سازی بحرانی برای Hot Path ها، رفع دو باگ مهم، و ۵ API جدید.

### 🚀 بهینه‌سازی‌های性能 (۶ مورد)

#### ۱. Expression Compile-Once API (`compileExpression`)

تابع جدید در `@zenith/expressions` که AST را یک‌بار parse می‌کند و یک closure برمی‌گرداند. در هر re-runِ Effect، فقط `evaluate(ast, ctx)` اجرا می‌شود — صفر Map operation.

```typescript
import { compileExpression } from '@zenith/expressions';

// compile-once — expr فقط یک‌بار parse می‌شود.
const evalFn = compileExpression('$user.age > 18');

const dispose = effect(() => {
  const value = evalFn(context); // صفر Map operation
  el.textContent = String(value);
});
```

تمام directive processor ها (text, bind, if, show, html, html-trusted, model, for, intersection, resource, fetch, components, virtual-list) به این API مهاجرت کردند.

#### ۲. Property Diffing در zen-bind

اگر مقدار Expression با قبلی `===` برابر باشد، `setAttribute` صدا زده نمی‌شود. همچنین در show, html, html-trusted, model اعمال شد.

```typescript
// v1.0.0 — automatic property diffing
let prevValue = undefined;
let isFirstRun = true;

effect(() => {
  const value = evalFn(context);
  if (!isFirstRun && prevValue === value) return; // skip DOM mutation!
  prevValue = value;
  isFirstRun = false;
  el.setAttribute(attrName, String(value));
});
```

#### ۳. zen-for Fast Path (`zen-static` attribute)

attribute جدید `zen-static` روی `<li zen-for>` فعال می‌شود. در این حالت:
- per-item Signal ساخته نمی‌شود.
- `createStaticLoopContext` (مقادیر مستقیم) به جای `createLoopContext` (getter).
- در تغییر لیست: full re-render به جای keyed diffing.

```html
<!-- برای لیست‌های فقط‌خواندنی -->
<li zen-for="item in $items" zen-key="item.id" zen-static="">
  <span zen-text="item.name"></span>
</li>
```

**محدودیت**: `zen-static` با `zen-model` کار نمی‌کند (signalsMap ساخته نمی‌شود).

#### ۴. DocumentFragment Batching

در initial mountِ zen-for (هم standard و هم static)، همه‌ی نودهای جدید در یک DocumentFragment جمع می‌شوند و یک‌بار `insertBefore` می‌شوند. DOM reflow از N به ۱ کاهش می‌یابد.

#### ۵. Compiler Walker Elimination Level 3

compiled module دیگر برای هر عنصر runtime directive، `Zen.start` صدا نمی‌زند (که باعث duplicate Event Delegation listeners می‌شد). حالا یک‌بار `Zen.start` روی dummy div برای setup، سپس `walkAndBind` برای هر عنصر.

#### ۶. DevTools Disable Option

`Zen.start(root, state, { devtools: false })` — وقتی `devtools: false`، `initDevTools` صدا زده نمی‌شود و `window.__ZENITH__` تنظیم نمی‌شود. `__trackDirective` به no-op تبدیل می‌شود.

```typescript
// Production
Zen.start(root, state, { devtools: false });

// Development (پیش‌فرض)
Zen.start(root, state);
```

### 🐛 رفع باگ‌های بحرانی (۲ مورد)

#### ۱. SSR Race Condition (100 concurrent requests)

`renderToString` قبلاً `globalThis` را mutate می‌کرد. در ۱۰۰ درخواست concurrent، race condition داشت. حالا از `AsyncLocalStorage` استفاده می‌کند.

#### ۲. Benchmark 100x Gap

zen-if mount (118ms) vs zen-text mount (13924ms) — ۱۰۰x اختلاف. علت: DevTools tracking. Fix: `devtools: false` option + unified benchmark scenarios.

### 🔧 API های جدید

| API | پکیج | توضیح |
|-----|------|-------|
| `compileExpression(expr)` | `@zenith/expressions` | compile-once closure |
| `Resource.destroy()` | `@zenith/resource` | teardown کامل |
| `Zen.start(root, state, options?)` | `@zenith/runtime` | با `ZenStartOptions` |
| `ZenStartOptions` | `@zenith/runtime` | `{ devtools?: boolean }` |
| `zen-static` attribute | `@zenith/runtime` | fast path برای zen-for |
| `domAls` | `@zenith/ssr` | AsyncLocalStorage instance |
| `getDOMGlobals()` | `@zenith/ssr` | دریافت DOM globals فعلی |
| `installDOMGlobalGetters()` | `@zenith/ssr` | نصب getter ها |
| `DOMGlobals` (type) | `@zenith/ssr` | interface برای DOM globals |
| `ZenithAttributes` (type) | `@zenith/runtime` | HTML attribute types |
| `AllZenithAttributes` (type) | `@zenith/runtime` | با generic `zen-bind:*` |

### 📊 Benchmark Results

| Benchmark | v0.6.3 | v1.0.0 | بهبود |
|-----------|--------|--------|-------|
| zen-text ۱۰k mount | ۷۱۸ el/sec | ۸۶k el/sec | **۱۲۰x** |
| zen-bind ۱۰k mount | ۵۷۹ el/sec | ۹۷k el/sec | **۱۶۸x** |
| zen-for ۱۰k init | ۱٬۲۲۴ items/sec | ۶۰k items/sec | **۴۹x** |
| zen-bind ۱۰k update | ۶۶۲k ops/sec | ۱.۳۵M ops/sec | **۲x** |
| zen-for zen-static ۱k init | — | ۱۰۱k items/sec | **۱.۹x vs standard** |

### 🔒 Security Audit

ممیزی امنیتی مستقل انجام شد — ۹۵۰ تست audit، صفر آسیب‌پذیری بحرانی.

### 📚 مستندات

- **[API Reference v1.0.0](./docs/api-v1.0.md)** — مرجع کامل API.
- **[Migration Guide](./docs/migration-guide.md)** — مهاجرت از 0.6.x.
- **[Performance Tuning](./docs/performance-tuning.md)** — راهنمای بهینه‌سازی.
- **[Security Audit](./tests/v1.0/security-audit/README.md)** — گزارش audit.

### 🧪 تست‌ها

- ۹۸ تست واحد (API های جدید v1.0.0).
- ۹۵۰ تست audit امنیتی.
- ۴۷ تست integration برای compiler (Level 3 Walker Elimination).
- ۴۲ تست برای کتابخانه‌ی error messages.
- ۲۲ تست برای zen-suspense.
- ۴۳ تست برای form validation.
- **مجموع: ۱۲۰۲ تست** — همه pass.
- `tsc --noEmit` با strict mode — صفر خطا.
- `bun run verify` — تست + typecheck + security + compiler.

### 🐛 رفع باگ‌های بحرانی (v1.0.1)

- **BUG-01/05**: `leaveTransition` اکنون cancel function برمی‌گرداند — memory leak هنگام toggle سریع و Zen.stop برطرف شد.
- **BUG-02**: zen-if parent of zen-for — fallback به `display:none` به جای unmount/remount.
- **BUG-03**: `FormStore.destroy()` اضافه شد — clear async validation timers.
- **BUG-04**: `zen-model` اکنون `$index` را در nested paths resolve می‌کند (`$items[$index].name`).
- **BUG-06**: Auth SSR — `_getStorage()` اکنون `__zenithSSR__` flag را چک می‌کند.
- **BUG-07**: i18n `toJalali()` — warning برای تاریخ‌های قبل از ۱۶۰۰ + validation خروجی.
- **BUG-08**: zen-for `indexKeysSeen` dead code حذف شد — duplicate key warning اضافه شد.
- **BUG-09**: SSR `deserializeState` — type validation + prototype pollution protection.

### 🔵 بهبودها (v1.0.1)

- **i18n API کامل جلالی**: `fromJalali`, `parseJalaliParts`, `compareJalali`, `addDaysJalali`, `isJalaliLeap`, `jalaliMonthDays`, `formatJalali`, `jalaliMonthName`.
- **virtual-list empty/loading slots**: `<template slot="empty">` و `<template slot="loading">`.
- **`zen-else` / `zen-else-if`**: پردازش زنجیره if-else-if-else در walker.
- **`afterFlush(cb)`**: hook در scheduler برای callback بعد از flush DOM.
- **VS Code Extension DevTools**: WebView Panel با آمار فریم‌ورک + status bar button.

---

## Framework Architecture (29 packages)

```
zenith/
├── CORE ENGINE
│   ├── @zenith/state              — Signal/Effect/Computed (Reactivity)
│   ├── @zenith/expressions        — Lexer/Parser/Evaluator/Validator
│   ├── @zenith/scheduler          — Microtask batching + Priority Queue (urgent/normal/idle)
│   └── @zenith/runtime            — DOM walker + all directives
│
├── UI LAYER
│   ├── @zenith/components         — Light DOM components (Props, Slots)
│   ├── @zenith/events             — Event Delegation + Modifiers (prevent/stop/enter/self/once)
│   ├── @zenith/actions            — Action Registry (sync + async)
│   ├── @zenith/transition         — CSS enter/leave animations
│   ├── @zenith/error-boundary     — Error boundaries + global handler
│   └── @zenith/suspense           — Async loading with fallback
│
├── ROUTING & DATA
│   ├── @zenith/router             — SPA Router (lazy pages, route cache, prefetch, zen-link)
│   ├── @zenith/data               — zen-fetch (declarative data fetching, AbortController)
│   ├── @zenith/resource           — CRUD Resource (dedup, cache, retry, optimistic, SWR, mutation queue)
│   ├── @zenith/crud              — Pre-built CRUD actions
│   └── @zenith/virtual-list      — Virtual scrolling (static + dynamic heights via ResizeObserver)
│
├── FORMS & STATE
│   ├── @zenith/form              — Form handling + sync/async validation + schema adapters
│   └── @zenith/store             — Global state management (Pinia-like, deep reactivity)
│
├── SECURITY & ENTERPRISE
│   ├── @zenith/security          — HTML Sanitizer (DOMParser-based, 14 forbidden tags)
│   ├── @zenith/auth              — Authentication (login/token/refresh, auto-refresh, persistence)
│   ├── @zenith/permission        — Authorization (RBAC + directives, super-admin, any:/all: syntax)
│   ├── @zenith/ssr               — Server-Side Rendering + Streaming + Hydration
│   └── @zenith/i18n              — Persian numbers, Jalali calendar, price formatting
│
├── PERFORMANCE
│   ├── @zenith/compiler          — Template Compilation (HTML → JS, build-time)
│   └── @zenith/dependency-graph  — Expression dependency extraction
│
├── DEVELOPER TOOLS
│   ├── @zenith/devtools          — DevTools Hook (window.__ZENITH__)
│   ├── @zenith/vite-plugin       — Vite plugin (HMR + auto-inject + compile-time HTML→JS)
│   ├── @zenith/cli               — CLI (create, generate, check -- 12 static analysis rules)
│   ├── vscode-extension/         — VSCode LSP (syntax, autocomplete, snippets)
│   └── devtools-extension/       — Chrome Extension (4 panels: Signals, Timeline, Components, Effects)
```

---

## Core Concepts

### Signal (Reactive State)

```typescript
import { signal, computed, effect } from '@zenith/state';

const count = signal(0);
const user = signal({ name: 'Ali', age: 25 });

count.get();           // 0
count.set(5);
user.set({ ...user.get(), name: 'Reza' });

// Computed (synchronous initial value, type-safe)
const doubled = computed(() => count.get() * 2);

// Effect (auto-rerun)
const dispose = effect(() => { console.log(count.get()); });
dispose(); // stop
```

### Expression Syntax

```html
<span zen-text="$count"></span>
<span zen-text="$user.name"></span>
<div zen-if="$count > 5">More than 5</div>
<div zen-if="$isLoggedIn && $user.age >= 18">Welcome</div>

<!-- String concatenation (NOT template literals) -->
<div zen-fetch="'/api/users/' + $user.id + '/posts'"></div>

<!-- Ternary -->
<span zen-text="$count > 0 ? $count : 'empty'"></span>

<!-- Bracket notation -->
<span zen-text="$items[0].name"></span>
<span zen-text="$data['key'].value"></span>
```

**IMPORTANT**: Template literals with `${}` interpolation are NOT supported. Use `+` concatenation.

---

## Directive Reference

### zen-text — Text rendering (XSS-safe)
```html
<span zen-text="$user.name"></span>
```

### zen-html — HTML rendering (sanitized)
```html
<div zen-html="$richContent"></div>
```
- Always sanitizes through `@zenith/security`

### zen-if — Conditional rendering
```html
<div zen-if="$isLoggedIn">Welcome</div>
<div zen-if="!$isLoggedIn">Please log in</div>
```

### zen-for — List rendering with keyed diffing
```html
<li zen-for="item in $items" zen-key="item.id">
  <span zen-text="$item.name"></span>
  <span zen-text="$index"></span>
</li>

<div zen-for="(product, i) in $products" zen-key="product.id">
  <span zen-text="$i"></span>: <span zen-text="$product.name"></span>
</div>
```
- zen-key required for proper diffing
- Fine-grained reactivity: each item gets its own Signal
- zen-model inside zen-for works (supports local context)

### zen-bind — One-way attribute binding
```html
<button zen-bind:disabled="$isProcessing">Save</button>
<div zen-bind:class="{ active: $isActive, hidden: !$isVisible }">
<a zen-bind:href="$url">Link</a>
```

### zen-model — Two-way binding
```html
<input zen-model="$user.name">
<input type="number" zen-model="$age">
<input type="checkbox" zen-model="$agreed">
<!-- Supports dot + bracket notation -->
<input zen-model="$user.profile.name">
<input zen-model="$items[0].name">
<!-- Inside zen-for (local context) -->
<input zen-model="item.name">
```

### zen-fetch — Declarative data fetching
```html
<div zen-fetch="'/api/products/' + $route.params.id" zen-state="product">
  <div zen-if="$product.loading">Loading...</div>
  <div zen-if="$product.error">Error: <span zen-text="$product.error"></span></div>
  <div zen-if="!$product.loading && !$product.error">
    <h2 zen-text="$product.data.name"></h2>
  </div>
</div>
```
- Reactive URL (re-fetches when $route changes)
- AbortController (old fetches cancelled)
- Race condition safe

### zen-action — Event handlers (sync + async)
```html
<button zen-action="save">Save</button>
<button zen-action:click.prevent="submit">Submit</button>
<input zen-action:keydown.enter="submitOnEnter">
```
- Modifiers: `.prevent`, `.stop`, `.immediate`, `.enter`, `.escape`, `.tab`, `.space`, `.shift`, `.ctrl`, `.alt`, `.meta`
- Async actions supported: `Zen.action('fetch', async ({ state }) => { ... })`

### zen-link — SPA navigation
```html
<a zen-link="/">Home</a>
<a zen-link="/products/101">Product 101</a>
```

### zen-error — Error boundary
```html
<div zen-error>
  <span zen-text="$user.name"></span>
  <template zen-fallback>
    <p style="color: red;">Failed to load</p>
  </template>
</div>
```

### zen-permission — Permission-based rendering
```html
<button zen-permission="users:delete">Delete</button>
<div zen-permission="any:users:edit,users:create">Edit or Create</div>
<div zen-permission="all:users:edit,users:create">Edit AND Create</div>
```

### zen-role — Role-based rendering
```html
<div zen-role="admin">Admin Panel</div>
<div zen-role="any:admin,editor">Editor Section</div>
```

### zen-resource — CRUD resource
```html
<div zen-resource="'/api/users'" zen-state="users">
  <div zen-if="$users.loading">Loading...</div>
  <div zen-for="user in $users.data" zen-key="user.id">
    <span zen-text="$user.name"></span>
    <button zen-action="crudDelete"
            zen-bind:data-resource="users"
            zen-bind:data-id="$user.id">Delete</button>
  </div>
</div>
```

### zen-validate — Form validation
```html
<input zen-model="$form.email" zen-validate="required,email">
<input zen-model="$form.age" zen-validate="required,min:18,max:120">
<input zen-model="$form.password" zen-validate="required,min:8">
```

---

## Component System

```html
<zen-component name="app-product-card">
  <template>
    <div class="card">
      <h3 zen-text="$name"></h3>
      <slot></slot>
      <slot name="actions"></slot>
    </div>
  </template>
</zen-component>

<app-product-card prop:name="product.name" prop:price="product.price" theme="dark">
  <p>Description</p>
  <button slot="actions" zen-action="buy">Buy</button>
</app-product-card>
```
- Props: `prop:name="expr"` (reactive), `theme="dark"` (literal)
- Slots: default + named
- Slot content uses parent context
- Template cache (WeakMap) for performance

---

## Router (SPA)

```html
<zen-router>
  <zen-route path="/" src="/pages/home.html"></zen-route>
  <zen-route path="/products/:id" src="/pages/product.html"></zen-route>
  <zen-route path="**" src="/pages/404.html"></zen-route>
</zen-router>
```
```typescript
Zen.navigate('/products/101');
// Route params in expressions: $route.params.id, $route.path
```

---

## Business Runtime

### Resource (CRUD with caching)

```typescript
import { createResource } from '@zenith/resource';

const users = createResource('users', {
  url: '/api/users',
  staleTime: 60000,    // 1 min cache
  retryCount: 3,       // auto-retry
  optimistic: true,    // optimistic updates
});

await users.list();                    // GET /api/users
await users.read(123);                 // GET /api/users/123
await users.create({ name: 'Ali' });   // POST
await users.update(123, { name: 'Reza' }); // PUT
await users.delete(123);               // DELETE
users.invalidate();                    // mark stale
users.setData(old => [...old, newItem]); // manual update
```

### Form + Validation

```typescript
import { createForm, defineRule } from '@zenith/form';

const form = createForm({
  email: { initial: '', rules: 'required,email' },
  password: { initial: '', rules: 'required,min:8' },
});

form.setValue('email', 'ali@test.com');
form.touch('email');
form.validate();   // returns { valid, fields }
form.getValues();  // { email: '...', password: '...' }
form.startSubmit();
form.endSubmit();
form.reset();

// Custom rule
defineRule('phone', (value) => {
  return /^09\d{9}$/.test(value)
    ? { valid: true, error: null }
    : { valid: false, error: 'Invalid phone' };
});
```

Built-in rules: `required`, `email`, `url`, `min:N`, `max:N`, `pattern:regex`, `equals:val`

### Store (Pinia-like)

```typescript
import { defineStore } from '@zenith/store';

const useUserStore = defineStore('user', {
  state: () => ({ name: '', age: 0, preferences: { theme: 'light' } }),
  getters: {
    isAdult: (state) => state.age >= 18,
    fullName: (state) => state.name,
  },
  actions: {
    setName(name: string) { this.state.name = name; },
    async fetchUser(id: number) {
      const res = await fetch(`/api/users/${id}`);
      const data = await res.json();
      this.state.name = data.name;
    },
  },
});

const store = useUserStore();
store.state.name = 'Ali';  // reactive
store.setName('Reza');     // action
store.isAdult;              // getter (computed)
store.$reset();
store.$patch({ name: 'New' });
```

### CRUD Actions (pre-built)

```html
<button zen-action="crudList" zen-bind:data-resource="users">Refresh</button>
<form zen-action:submit.prevent="crudCreate" zen-bind:data-resource="users">
  <input name="name"><input name="email"><button type="submit">Add</button>
</form>
<button zen-action="crudUpdate" zen-bind:data-resource="users"
        zen-bind:data-id="$user.id" zen-bind:data-body="$user">Update</button>
<button zen-action="crudDelete" zen-bind:data-resource="users"
        zen-bind:data-id="$user.id">Delete</button>
```

---

## Enterprise Features

### Auth

```typescript
import { createAuth } from '@zenith/auth';

const auth = createAuth({
  loginUrl: '/api/auth/login',
  logoutUrl: '/api/auth/logout',
  refreshUrl: '/api/auth/refresh',
  meUrl: '/api/auth/me',
  tokenStorage: 'localStorage',
  autoRefresh: true,
  refreshThreshold: 300, // 5 min before expiry
});

// In state: { auth: auth.signal }
// In HTML: $auth.user, $auth.isAuthenticated, $auth.loading, $auth.error

await auth.login({ email: 'ali@test.com', password: 'secret' });
await auth.logout();
await auth.fetchUser();  // restore session
await auth.refresh();
auth.authHeaders();      // { Authorization: 'Bearer ...' }
auth.isTokenExpiringSoon();
```

### Permission

```typescript
import { createPermissionManager } from '@zenith/permission';

const perms = createPermissionManager('default', { superAdminRole: 'super-admin' });
perms.setUserAccess(['admin', 'editor'], ['users:read', 'users:edit', 'posts:delete']);

perms.hasRole('admin');       // true
perms.can('users:edit');      // true
perms.can('users:delete');    // false
perms.checkPermission('any:users:read,users:edit'); // true
perms.checkRole('all:admin,verified'); // false

// Route guard
import { createGuard } from '@zenith/permission';
const adminGuard = createGuard('admin', 'role');
if (!adminGuard()) { Zen.navigate('/login'); }
```

### SSR + Hydration

```typescript
// Server:
import { renderToString, generateFullPage } from '@zenith/ssr';
const result = await renderToString(html, state, { route: '/' });
const page = generateFullPage(result, '<title>My App</title>');
// Send page as HTTP response

// Client:
import { hydrate } from '@zenith/ssr';
const result = await hydrate(document.getElementById('app')!, (state) => {
  Zen.action('increment', ({ state }) => state.count.set(state.count.get() + 1));
});
// No flicker, better SEO, faster TTI
```

---

## Error Handling

```typescript
import { onError, errorSignal } from '@zenith/runtime';

onError((error) => {
  console.error('Zenith error:', error.message, error.source);
  // Send to error tracking
});
```

```html
<div zen-error>
  <span zen-text="$user.name"></span>
  <template zen-fallback><p>Failed to load</p></template>
</div>
```

---

## Transitions

```typescript
import { enterTransition, leaveTransition } from '@zenith/transition';
enterTransition(el, 'fade', 300);
leaveTransition(el, 'fade', 300, () => el.remove());
```

---

## Scheduler

```typescript
// All signal.set() calls are auto-batched via microtask
signal.set(1); signal.set(2); signal.set(3);
flushSync(); // DOM updated once with value 3
```

---

## Security

- `zen-html` always sanitizes (removes `<script>`, `on*`, `javascript:`)
- Expression Engine blocks `window`, `document`, `eval`, `__proto__`, `constructor`
- Both dot and bracket notation blocked for prototype pollution

---

## Compiler (Performance)

```typescript
import { compileTemplate } from '@zenith/compiler';
const compiled = compileTemplate('<div zen-text="$count">Hi</div>');
// compiled.code → optimized JS function
// compiled.dependencies → [{ signal: 'count', path: [] }]
// compiled.isStatic → false
```

---

## DevTools

### Browser console
```javascript
window.__ZENITH__.version;
window.__ZENITH__.getSignals();
window.__ZENITH__.getTimeline(50);
window.__ZENITH__.onStateChange(change => console.log(change));
```

### Chrome Extension (4 panels)
Load `packages/devtools-extension/` as unpacked extension. Panels:
1. **Signal Inspector** — all signals with values + subscriber counts
2. **Timeline** — state change history (old → new)
3. **Component Tree** — registered components with usage counts
4. **Effect Viewer** — active/disposed effects with dependencies

### VSCode Extension
- Syntax highlighting for `zen-*` directives
- Autocomplete (18 directives with snippets)
- Hover hints
- Expression validation
- Commands: Create Component / Page / Action
- Snippets: `zcomp`, `ztext`, `zif`, `zfor`, `zmodel`, `zaction`, `zfetch`, etc.

---

## Complete App Example

### index.html
```html
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="UTF-8"><title>My Zenith App</title></head>
<body>
  <div id="app">
    <nav>
      <a zen-link="/">Home</a>
      <a zen-link="/products">Products</a>
    </nav>

    <div>
      <span zen-text="$count"></span>
      <button zen-action="increment">+</button>
    </div>

    <!-- Auth -->
    <div zen-if="$auth.user">
      Welcome <span zen-text="$auth.user.name"></span>
      <button zen-action="authLogout">Logout</button>
    </div>

    <!-- CRUD -->
    <div zen-resource="'/api/products'" zen-state="products">
      <div zen-for="p in $products.data" zen-key="p.id">
        <span zen-text="$p.name"></span>
        <button zen-permission="products:delete"
                zen-action="crudDelete"
                zen-bind:data-resource="products"
                zen-bind:data-id="$p.id">Delete</button>
      </div>
    </div>

    <!-- Router -->
    <zen-router>
      <zen-route path="/" src="/pages/home.html"></zen-route>
      <zen-route path="/products/:id" src="/pages/product.html"></zen-route>
      <zen-route path="**" src="/pages/404.html"></zen-route>
    </zen-router>
  </div>
  <script type="module" src="/main.ts"></script>
</body>
</html>
```

### main.ts
```typescript
import { signal } from '@zenith/state';
import { Zen } from '@zenith/runtime';
import { createAuth } from '@zenith/auth';
import { createPermissionManager } from '@zenith/permission';
import './packages/crud/src/index'; // register CRUD actions

const auth = createAuth({ loginUrl: '/api/auth/login', meUrl: '/api/auth/me' });
const perms = createPermissionManager();

const state = {
  count: signal(0),
  auth: auth.signal,
};

Zen.action('increment', ({ state }) => state.count.set(state.count.get() + 1));
Zen.action('authLogout', async () => { await auth.logout(); perms.clear(); });

// Restore session
auth.fetchUser().then(() => {
  if (auth.user) {
    perms.setUserAccess(auth.user.roles || [], auth.user.permissions || []);
  }
});

Zen.start(document.getElementById('app')!, state);
```

---

## LLM Coding Guidelines

### DO:
- ✅ Use `$` prefix for state: `$user.name`, `$count`
- ✅ Use string concatenation (`'text' + $var`)
- ✅ Always provide `zen-key` for `zen-for`
- ✅ Use `prop:name` for component props
- ✅ Register actions before `Zen.start()`
- ✅ Handle loading/error/success in `zen-fetch`
- ✅ Use `zen-link` for SPA navigation
- ✅ Use `@zenith/resource` for CRUD operations
- ✅ Use `@zenith/form` for form validation
- ✅ Use `@zenith/store` for global state
- ✅ Use `@zenith/auth` + `@zenith/permission` for enterprise apps
- ✅ Use `@zenith/ssr` for SSR + hydration
- ✅ Async actions are supported

### DON'T:
- ❌ Use template literals with `${}` in expressions
- ❌ Use `addEventListener` — use `zen-action`
- ❌ Access `window`/`document`/`eval` in expressions (blocked)
- ❌ Use `__proto__`/`constructor` in expressions (blocked)
- ❌ Mix `zen-text` and `zen-html` on same element
- ❌ Use uppercase in component/prop names
- ❌ Forget `Zen.start(root, state)`

### Expression capabilities:
- Dot + bracket notation: `$items[0].name`, `$data['key']`
- Ternary: `$cond ? $a : $b`
- Logical: `&&`, `||`, `!`
- Comparison: `===`, `!==`, `>`, `<`, `>=`, `<=`
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Template literals WITHOUT `${}`: `` `hello` `` ✅ (simple only)

---

## Common Patterns

### Pattern: CRUD list with resource + delete
```html
<div zen-resource="'/api/users'" zen-state="users">
  <div zen-for="u in $users.data" zen-key="u.id">
    <span zen-text="$u.name"></span>
    <button zen-action="crudDelete"
            zen-bind:data-resource="users"
            zen-bind:data-id="$u.id">Delete</button>
  </div>
</div>
```

### Pattern: Form with validation
```html
<form zen-action:submit.prevent="submitForm">
  <input zen-model="$form.email" zen-validate="required,email">
  <span zen-if="$form.email && !$form.email.includes('@')" style="color:red">Invalid</span>
  <input zen-model="$form.password" zen-validate="required,min:8" type="password">
  <button zen-bind:disabled="$form.password.length < 8">Submit</button>
</form>
```

### Pattern: Protected route
```html
<div zen-role="admin">
  <h2>Admin Panel</h2>
  <template zen-fallback><p>Access denied</p></template>
</div>
```

### Pattern: Auth flow
```html
<div zen-if="$auth.user">
  <span zen-text="$auth.user.name"></span>
  <button zen-action="authLogout">Logout</button>
</div>
<div zen-if="!$auth.user">
  <form zen-action:submit.prevent="authLogin">
    <input name="email"><input name="password" type="password">
    <button type="submit">Login</button>
  </form>
</div>
```

### Pattern: Error boundary
```html
<div zen-error>
  <span zen-text="$user.name"></span>
  <template zen-fallback><p>⚠️ Failed to load user</p></template>
</div>
```

### Pattern: SSR + Hydration
```typescript
// Server
const result = await renderToString(html, state, { route: '/' });
res.send(generateFullPage(result));

// Client
await hydrate(root, (state) => {
  Zen.action('increment', ({ state }) => state.count.set(state.count.get() + 1));
});
```

---

## Production Checklist

- [ ] `window.__ZENITH_DEV__ = false` (disables logs + DevTools)
- [ ] `window.__ZENITH_DEVTOOLS__ = false` (disables State Registry overhead)
- [ ] All `zen-html` content sanitized (automatic)
- [ ] All `zen-for` have `zen-key`
- [ ] Router has `**` catch-all
- [ ] Auth configured with `autoRefresh`
- [ ] Permissions set after login
- [ ] SSR with hydration for SEO
- [ ] Test with Chrome Extension DevTools

---

## CLI

```bash
npx @zenith/cli create my-app          # new project
npx @zenith/cli create my-app --pwa    # PWA project (with service worker + manifest)
npx @zenith/cli g component UserCard   # src/components/user-card.html
npx @zenith/cli g page About           # pages/about.html
npx @zenith/cli g action saveUser      # src/actions/save-user.ts
npx @zenith/cli check [path]           # static analysis of HTML files
npx @zenith/cli check --strict         # CI mode (warnings → errors)
npx @zenith/cli info                   # show framework info
```

## Static Analysis Rules (zenith check)

| Rule | Severity | Description |
|------|----------|-------------|
| Z100 | error | compileAndRender usage (removed for security) |
| Z101 | error | eval() or new Function() in `<script>` |
| Z200 | error | Deprecated directive (zen-compile) |
| Z201 | warning | Unknown directive (typo) |
| Z300 | warning | zen-for without zen-key |
| Z301 | error | zen-text with empty expression |
| Z302 | error | zen-if with empty condition |
| Z400 | error | Expression syntax error |
| Z500 | info | $parent used without property access |
| Z600 | error | zen-route without src |
| Z601 | error | zen-route without path |
| Z700 | warning | zen-link without href |

## Scheduler Priority Queue

```ts
import { scheduleEffect, flushSync, type Priority } from '@zenith/scheduler';

// Priority levels: 'urgent' > 'normal' (default) > 'idle'
scheduleEffect(() => updateCriticalState(), 'urgent');   // runs first
scheduleEffect(() => updateDOM(), 'normal');             // runs second
scheduleEffect(() => logAnalytics(), 'idle');            // runs last

// Same-priority effects preserve insertion order (FIFO).
// Re-scheduling an existing effect with higher priority upgrades it.
```

## Virtual List Dynamic Heights

```html
<!-- Static heights (default): each item is exactly 40px -->
<div zen-virtual-list="$items" zen-key="$item.id" zen-item-height="40" zen-buffer="5">
  <span zen-text="$item.name"></span>
</div>

<!-- Dynamic heights: each item measured via ResizeObserver -->
<div zen-virtual-list="$items" zen-key="$item.id"
     zen-dynamic-heights="true" zen-item-height="40" zen-buffer="5">
  <span zen-text="$item.name"></span>
  <p zen-if="$item.description" zen-text="$item.description"></p>
</div>
```

## Vite Plugin Compiler (Build-Time HTML Compilation)

```ts
// vite.config.ts
import { zenithPlugin } from '@zenith/vite-plugin';

export default {
  plugins: [
    zenithPlugin({
      compile: { enabled: true, strict: false },  // build-time HTML → JS
      autoInjectDevtools: true,                     // dev only
      enableHtmlHMR: true,                          // dev only
    }),
  ],
};
```

When `compile.enabled` is true in production build:
1. HTML files with `zen-*` directives are parsed at build time.
2. Expressions are validated (syntax errors fail the build in strict mode).
3. Directives are replaced with `data-zenith-compiled="<directive>"` attributes.
4. A virtual `.zenith.js` module is generated with pre-compiled render function.
5. A `<script type="module" src="/<name>.zenith.js">` is injected into HTML.

This eliminates runtime DOM walking cost and enables tree-shaking of unused directives.

---

## Version: v1.4.0 | 32 packages | 1200+ tests | 32 directives + 3 stateful | Production Ready (Strict Mode)
