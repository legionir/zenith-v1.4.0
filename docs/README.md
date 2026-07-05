# 🏔️ Zenith Framework

> یک فریم‌ورک **HTML-First** و واکنش‌گرا (Reactive) برای ساخت رابط‌های کاربری مدرن — بدون Virtual DOM، بدون JSX، بدون Build Step اجباری.

[![Version](https://img.shields.io/badge/version-1.4.0-brightgreen)]()
[![Tests](https://img.shields.io/badge/tests-1202%20+%201911%20fuzz-brightgreen)]()
[![Packages](https://img.shields.io/badge/packages-31-blue)]()
[![Stateful](https://img.shields.io/badge/stateful%20components-3-purple)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict%20mode-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## 📢 تازه‌ها — نسخه ۱.۴.۰

نسخه‌ی **Major Audit Fixes** منتشر شد — رفع جامع تمام یافته‌های گزارش‌های حسابرسی:

- 🔴 **۱۵۶+ باگ رفع‌شده** در تمام ۳۱ پکیج — از نشت حافظه و race condition تا XSS و directory traversal
- 🟢 **۷۰+ بهبود** — middleware pipeline، cache system، abort controller، lazy initialization
- 🧠 **Core Engine**: Lazy Computed, Circular dependency fix (state), Cache stats (expressions), Priority queue optimization, Time-slicing (scheduler)
- 🎨 **DOM Directives**: MutationObserver-based component cleanup, WAAPI transitions, IntersectionObserver preload
- 🛣️ **Routing & Data**: LRU cache, navigation guards, query params, SWR cache, bulk delete, per-request AbortController
- 🏢 **Business Runtime**: Event emitter (auth), route guards (permission), per-field debounce, deep merge limit
- 🔒 **Security**: SVG/MathML blocking, Trusted Types, CSP generator, sanitizeCSS
- ⚙️ **Build & Tooling**: Glob-to-regex, DevTools WebView data, Semantic Tokens Provider, Signal Hover

برای جزئیات کامل به [CHANGELOG.md](./CHANGELOG.md) مراجعه کنید.

---

## ✨ ویژگی‌های کلیدی

- **HTML-First** — منطق برنامه با directiveهای `zen-*` در HTML نوشته می‌شود، نه در JSX یا Template Strings.
- **Signal-based Reactivity** — Fine-grained reactivity بدون Virtual DOM. فقط کامپوننت‌های وابسته به یک Signal آپدیت می‌شوند.
- **Expression Engine امن** — Lexer/Parser/Evaluator اختصاصی بدون `eval()` یا `new Function()`. ضد XSS.
- **Automatic Batching** — Scheduler مبتنی بر Microtask: ۱۰۰ `set` متوالی → ۱ DOM Update.
- **RTL & Persian-first** — پشتیبانی داخلی از اعداد فارسی، تاریخ شمسی، و راست‌چین.
- **TypeScript Strict** — همه‌ی ۲۹ پکیج با strict mode کامل (شامل `noUncheckedIndexedAccess`).
- **1202 تست** — Unit tests، Integration tests، و Static analysis tests.
- **PWA Ready** — `zenith create my-app --pwa` با Service Worker و manifest آماده.
- **SSR** — رندر سمت سرور با Streaming و Hydration.
- **DevTools** — Chrome Extension با ۴ پنل (Signals, Timeline, Components, Effects).

---

## 📊 آمار پروژه

| معیار | مقدار |
|------|-------|
| نسخه فعلی | **1.4.0** |
| تعداد پکیج‌ها | 31 |
| تعداد تست‌ها | 1202 + 1911 fuzz + 950 audit |
| تعداد directiveها | 32+ |
| Stateful Components | 3 |
| قابلیت‌های جدید در ۱.۴.0 | ۱۵۶+ باگ‌فیکس + ۷۰+ بهبود در ۳۱ پکیج |
| خطوط کد (بدون dist) | ~18000 |
| خطای TypeScript | 0 |
| Bundle size (runtime) | ~14KB gzipped |
| dependencies | صفر (فقط peer deps) |

---

## 🚀 راه‌اندازی سریع

```bash
# ساخت پروژه جدید
npx @zenith/cli create my-app

# یا پروژه PWA
npx @zenith/cli create my-app --pwa

cd my-app
npm install
npm run dev
```

سپس `http://localhost:3000` را باز کنید.

---

## 📁 ساختار Monorepo

```
zenith/
├── packages/
│   ├── 🧠 CORE ENGINE
│   │   ├── state/              # Signal, effect, computed, batch
│   │   ├── expressions/        # Lexer, Parser, Evaluator (no eval)
│   │   ├── scheduler/          # Microtask batching + priority queue
│   │   └── runtime/            # DOM walker + all directives
│   │
│   ├── 🎨 DOM DIRECTIVES
│   │   ├── events/             # Event delegation + modifiers
│   │   ├── components/         # Light DOM components + slots
│   │   ├── transition/         # CSS transitions
│   │   ├── error-boundary/     # zen-error error boundaries
│   │   └── suspense/           # zen-suspense async loading
│   │
│   ├── 🛣️ ROUTING & DATA
│   │   ├── router/             # SPA router + lazy loading + prefetch
│   │   ├── data/               # zen-fetch declarative data
│   │   ├── resource/           # CRUD resource with cache + retry
│   │   └── virtual-list/       # 10000+ items virtualization
│   │
│   ├── 🏢 BUSINESS RUNTIME
│   │   ├── form/               # Form store + validators + schema
│   │   ├── store/              # Pinia-like global stores
│   │   ├── crud/               # Pre-built CRUD actions
│   │   ├── auth/               # Authentication + token refresh
│   │   ├── permission/         # RBAC + permission directives
│   │   └── i18n/               # Persian numbers + Jalali calendar
│   │
│   ├── 🔒 SECURITY
│   │   └── security/           # HTML sanitizer (DOMParser-based)
│   │
│   ├── ⚙️ BUILD & TOOLING
│   │   ├── compiler/           # HTML → JS compilation
│   │   ├── vite-plugin/        # Vite plugin (HMR + compile)
│   │   ├── cli/                # zenith create / generate / check
│   │   ├── ssr/                # Server-side rendering
│   │   ├── devtools/           # DevTools hook + Chrome extension
│   │   ├── vscode-extension/   # Syntax highlighting + autocomplete
│   │   └── dependency-graph/   # Expression dependency extractor
│   │
│   └── actions/                # Action registry
│
├── examples/
│   ├── index.html              # 🏠 Landing page + demo links + Changelog
│   ├── LLM-GUIDE.md            # 🤖 Complete LLM developer guide
│   ├── CHANGELOG.md            # 📋 Version history
│   ├── demos/                  # 🎬 Interactive demos per package
│   └── zenith-v0.2.0.zip       # 📦 Full source ZIP (downloadable)
│
├── CHANGELOG.md                # 📝 Changelog (detailed)
└── worklog.md                  # 📝 Multi-agent work log
```

---

## 📦 فهرست کامل پکیج‌ها

### Core Engine

| پکیج | توضیح | تست |
|------|-------|-----|
| `@zenith/state` | Signal, effect, computed, batch — قلب reactivity | 32 |
| `@zenith/expressions` | Lexer, Parser, Evaluator بدون eval | 72 |
| `@zenith/scheduler` | Microtask batching + priority queue (urgent/normal/idle) | 16 |
| `@zenith/runtime` | DOM walker + همه directiveها (zen-text, zen-if, zen-for, ...) | 69 + 88 |

### DOM Directives

| پکیج | توضیح |
|------|-------|
| `@zenith/events` | Event Delegation با modifierها (prevent, stop, enter, self, once, focusin, focusout) |
| `@zenith/components` | Light DOM components با props و slots |
| `@zenith/transition` | CSS transition هنگام enter/leave (double rAF + transitionend) |
| `@zenith/error-boundary` | Error boundary با zen-error |
| `@zenith/suspense` | Async loading با zen-suspense |

### Routing & Data

| پکیج | توضیح |
|------|-------|
| `@zenith/router` | SPA router با lazy loading, prefetch, route cache |
| `@zenith/data` | Declarative data fetching با AbortController |
| `@zenith/resource` | CRUD resource با cache, retry, optimistic updates, SWR |
| `@zenith/virtual-list` | Virtual scrolling با static و dynamic heights |

### Business Runtime

| پکیج | توضیح |
|------|-------|
| `@zenith/form` | Form store با sync/async validation, schema adapter, type coercion |
| `@zenith/store` | Pinia-like global stores با deep reactivity |
| `@zenith/crud` | Pre-built CRUD actions |
| `@zenith/auth` | Authentication با token/refresh, auto-refresh, persistence |
| `@zenith/permission` | RBAC با super-admin, expression syntax (any:/all:) |
| `@zenith/i18n` | اعداد فارسی، تاریخ شمسی، فرمت قیمت |

### Security

| پکیج | توضیح |
|------|-------|
| `@zenith/security` | HTML sanitizer با DOMParser (۱۴ تگ ممنوع، event handler removal, frameset-safe) |

### Build & Tooling

| پکیج | توضیح |
|------|-------|
| `@zenith/compiler` | Compile-time HTML → JS transformation (با sanitizeHTML در zen-html) |
| `@zenith/vite-plugin` | Vite plugin با HMR, DevTools auto-inject, build-time compile |
| `@zenith/cli` | `zenith create / generate / check` commands |
| `@zenith/ssr` | SSR با streaming و hydration |
| `@zenith/devtools` | DevTools hook + Chrome Extension (۴ پنل) |
| `@zenith/vscode-extension` | Syntax highlighting, autocomplete, snippets |
| `@zenith/dependency-graph` | Expression dependency extractor |
| `@zenith/actions` | Action registry |

---

## 🎯 directiveهای پشتیبانی‌شده

| Directive | توضیح | مثال |
|-----------|-------|------|
| `zen-text` | رندر متن (XSS-safe) | `<span zen-text="$user.name">` |
| `zen-html` | رندر HTML (sanitized — همیشه در runtime و compiled) | `<div zen-html="$content">` |
| `zen-if` | نمایش شرطی (با transition support) | `<div zen-if="$count > 0">` |
| `zen-show` | toggle display | `<div zen-show="$visible">` |
| `zen-for` | لیست با keyed diffing (با enter/leave transition) | `<li zen-for="$item in $items" zen-key="$item.id">` |
| `zen-bind` | اتصال attribute | `<a zen-bind:href="$url">` |
| `zen-model` | Two-way binding (در کد کامپایل‌شده با signal.set) | `<input zen-model="$name">` |
| `zen-action` | Event handler (با .self, .once, .prevent, .enter, ...) | `<button zen-action:click.self.once="save">` |
| `zen-fetch` | Fetch declarative | `<div zen-fetch="'/api/users'">` |
| `zen-resource` | CRUD resource | `<div zen-resource="$userResource">` |
| `zen-link` | SPA navigation | `<a zen-link="/about">` |
| `zen-permission` | Permission-based render | `<div zen-permission="users:edit">` |
| `zen-role` | Role-based render | `<div zen-role="admin">` |
| `zen-error` | Error boundary | `<div zen-error="handler">` |
| `zen-suspense` | Async loading | `<div zen-suspense>` |
| `zen-virtual-list` | Virtual scrolling | `<div zen-virtual-list="$items">` |
| `zen-validate` | Form validation (با type coercion عدد) | `<input zen-validate="required,min:18">` |
| `zen-transition` | CSS transitions (double rAF + transitionend) | `<div zen-transition="fade">` |

---

## 🧪 تست کردن

```bash
# اجرای همه تست‌ها
npm test

# typecheck
npm run typecheck

# static analysis روی فایل‌های HTML
npx @zenith/cli check ./src --strict
```

---

## 📚 مستندات

- **[API Reference v1.0.0](./docs/api-v1.0.md)** — مرجع کامل API های v1.0.0
- **[Migration Guide](./docs/migration-guide.md)** — مهاجرت از 0.6.x به 1.0.0
- **[Performance Tuning](./docs/performance-tuning.md)** — راهنمای بهینه‌سازی performance
- **[CHANGELOG.md](./CHANGELOG.md)** — تاریخچه‌ی کامل تغییرات
- **[LLM-GUIDE.md](./LLM-GUIDE.md)** — راهنمای کامل برای LLMها و توسعه‌دهندگان
- **[BENCHMARKS.md](./BENCHMARKS.md)** — نتایج benchmark (Chrome Headless)
- **[Security Audit](../tests/v1.0/security-audit/README.md)** — گزارش audit مستقل
- **[دموهای تعاملی](./demos/)** — ۲۰+ دموی قابل اجرا

---

## 🎬 دموهای تعاملی

در `demos/`:

- **state** — Signal، effect، computed
- **expressions** — Expression engine
- **runtime** — zen-text, zen-if, zen-for, zen-model, zen-bind
- **scheduler** — Automatic batching، priority queue
- **events** — Event delegation با modifierها (شامل .self, .once, focusin/focusout)
- **components** — Light DOM components
- **router** — SPA routing با lazy loading
- **security** — HTML sanitizer (frameset-safe)
- **i18n** — اعداد فارسی، تاریخ شمسی + API کامل جلالی (fromJalali، formatJalali، isJalaliLeap)
- **form** — Validation engine (با type coercion عدد)
- **form-v2** — Form v1.0: async validators، nested validation، cross-field، lifecycle hooks
- **store** — Pinia-like stores (با Computed<R> getter type)
- **auth** — Authentication flow
- **permission** — RBAC
- **resource** — CRUD با cache
- **virtual-list** — 10000+ items با empty/loading slots
- **transition** — CSS animations (double rAF + transitionend + cancel function + race condition fixed)
- **suspense** — Suspense v1.0: fallback/timeout/error slots + zen-fetch integration
- **error-boundary** — Error handling
- **integration** — دموی ترکیبی همه پکیج‌ها

---

## 📜 لایسنس

MIT © Zenith Contributors

---

## Version: 1.4.0 | 32 packages | 1200+ tests | 32 directives + 3 stateful | Production Ready (Strict Mode)
