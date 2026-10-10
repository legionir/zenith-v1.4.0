<p align="center">
  <img alt="Zenith" src="https://img.shields.io/badge/Zenith-v1.4.0-6c5ce7?style=for-the-badge">
  <a href="https://github.com/legionir/zenith-v1.4.0/actions/workflows/main.yml"><img alt="CI" src="https://github.com/legionir/zenith-v1.4.0/workflows/CI/badge.svg?branch=audit%2Fconsolidated-report"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="docs/decisions/DEC-007-node-floor.md"><img alt="node" src="https://img.shields.io/badge/node-%E2%89%A518.19-brightgreen"></a>
</p>

# Zenith Framework

**Zenith یک فریم‌ورک فرانت‌اند HTML-First است** — UI را مستقیم روی HTML واقعی با directiveهایی مثل `zen-text`، `zen-if` و `zen-bind:*` می‌سازد؛ هستهٔ آن یک سیستم **Signal** ریزدانه (fine-grained) بدون Virtual DOM است. بدون bundler شروع کنید، با compiler و vite-plugin بزرگ شوید.

- ⚡ **Fine-grained reactivity** — فقط وابستگی‌های واقعی update می‌شوند (بدون diff درخت)
- 🧲 **HTML-First** — قالب شما همان HTML است؛ compile اختیاری است، نه اجباری
- 🧩 **۳۷ پکیج ماژولار** (از `shared`/`scheduler` تا SSR، CRUD، auth، i18n جلالی و devtools)
- 🔒 **مرزهای امنیتی** — sanitizer مستقل، expression evaluator بدون `eval` (سیاست: [SECURITY.md](SECURITY.md))
- 🖥️ **SSR + Hydration** و پشتیبانی service-worker آفلاین

> جزئیات معماری و لایه‌ها: [ARCHITECTURE.md](ARCHITECTURE.md) · فهرست مستندات: [docs/README.md](docs/README.md)

---

## 🚀 شروع سریع (کمتر از ۵ دقیقه)

Zenith را می‌توان بدون هیچ toolchain ای در مرورگر اجرا کرد. باندل مرورگری آماده در artifact هر build («bundles») و در tarball هر release tag موجود است؛ تا انتشار رسمی npm (issue #66) از همین باندل‌ها یا `npm link` ورک‌اسپیس استفاده کنید:

```bash
npm ci && npm run build && npm run build:browser
```

سپس یک `index.html` بسازید:

```html
<!doctype html>
<html lang="fa">
  <head>
    <meta charset="utf-8" />
    <title>Zenith Hello</title>
    <script type="importmap">
      {
        "imports": {
          "@zenith/runtime": "/browser-bundles/zenith-runtime.js"
        }
      }
    </script>
  </head>
  <body>
    <div id="app">
      <h1>سلام <span zen-text="$name"></span>!</h1>
      <p>شمارش: <span zen-text="$count"></span> (دو‌برابر: <span zen-text="$double"></span>)</p>
      <button zen-action="inc">+1</button>
    </div>
    <script type="module">
      // باندل مرورگری zenith-runtime.js تمام هسته‌ها (state/scheduler/…) را inline دارد.
      import { Zen, signal, computed } from '@zenith/runtime';

      const name = signal('Zenith');
      const count = signal(0);
      const double = computed(() => count.get() * 2);

      Zen.action('inc', ({ state }) => state.count.set(state.count.get() + 1));

      Zen.start(document.getElementById('app'), { name, count, double });
    </script>
  </body>
</html>
```

هر کلیک فقط گره‌های `<span>` وابسته را update می‌کند — نه کل درخت (این نمونه با Playwright هدلس روی باندل واقعی راستی‌آزمایی شده است). handlerها را با `Zen.action` ثبت کنید؛ `zen-action` فقط رجیستری اکشن‌ها را نگاه می‌کند. برای مسیر project-محور: `npx @zenith/cli create my-app` (scaffold) و `@zenith/vite-plugin` برای HMR.

نمونه‌های کامل‌تر: `demos/` (از جمله `ecommerce-demo/` و `dashboard/`) — توجه: دموها عمداً fixtureهای آموزشی XSS دارند؛ خارج از دامنهٔ امنیتی هستند ([SECURITY.md](SECURITY.md)).

---

## 📦 پکیج‌ها (۳۷)

لایه‌ها طبق [ARCHITECTURE.md §۱](ARCHITECTURE.md). تا پیش از انتشار رسمی npm (#66) همهٔ پکیج‌ها از راه source ورک‌اسپیس و باندل‌های مرورگری در دسترس‌اند.

| پکیج | لایه | نقش | README |
| --- | --- | --- | --- |
| [`@zenith/scheduler`](packages/scheduler) | L0 | زمان‌بند microtask و batching effectها | [📄](packages/scheduler/README.md) |
| [`@zenith/errors`](packages/errors) | L0 | `ZenithError` و کدهای ZEN | [📄](packages/errors/README.md) |
| [`@zenith/shared`](packages/shared) | L0 | نوع‌ها/ابزارهای مشترک L0 (Disposable، mergeOptions، پارسر attribute) | [📄](packages/shared/README.md) |
| [`@zenith/security`](packages/security) | L0 | sanitizer، CSP، TrustedTypes | [📄](packages/security/README.md) |
| [`@zenith/i18n`](packages/i18n) | L0 | ارقام فارسی/عربی، تقویم جلالی | [📄](packages/i18n/README.md) |
| [`@zenith/state`](packages/state) | L1 | signal / computed / effect / batch | [📄](packages/state/README.md) |
| [`@zenith/expressions`](packages/expressions) | L1 | evaluator امن عبارت‌ها (بدون `eval`) | [📄](packages/expressions/README.md) |
| [`@zenith/dependency-graph`](packages/dependency-graph) | L1 | استخراج وابستگی signal از عبارت‌ها | [📄](packages/dependency-graph/README.md) |
| [`@zenith/router`](packages/router) | L2 | مسیریابی SPA با History API | [📄](packages/router/README.md) |
| [`@zenith/events`](packages/events) | L2 | event delegation | [📄](packages/events/README.md) |
| [`@zenith/components`](packages/components) | L2 | کامپوننت Light DOM، props، slots | [📄](packages/components/README.md) |
| [`@zenith/resource`](packages/resource) | L2 | دریافت declarative داده (cache/dedup/retry) | [📄](packages/resource/README.md) |
| [`@zenith/data`](packages/data) | L2 | دایرکتیو `zen-fetch` | [📄](packages/data/README.md) |
| [`@zenith/http`](packages/http) | L2 | کلاینت HTTP با interceptor و retry | [📄](packages/http/README.md) |
| [`@zenith/actions`](packages/actions) | L2 | رجیستری action برای `zen-action` | [📄](packages/actions/README.md) |
| [`@zenith/auth`](packages/auth) | L2 | ورود/خروج، توکن، refresh خودکار | [📄](packages/auth/README.md) |
| [`@zenith/permission`](packages/permission) | L2 | RBAC و `zen-permission` | [📄](packages/permission/README.md) |
| [`@zenith/store`](packages/store) | L2 | store سراسری شبیه Pinia | [📄](packages/store/README.md) |
| [`@zenith/form`](packages/form) | L2 | فرم و اعتبارسنجی | [📄](packages/form/README.md) |
| [`@zenith/notifications`](packages/notifications) | L2 | toast، alert، confirm | [📄](packages/notifications/README.md) |
| [`@zenith/error-boundary`](packages/error-boundary) | L2 | مرز خطا و handler سراسری | [📄](packages/error-boundary/README.md) |
| [`@zenith/suspense`](packages/suspense) | L2 | ردگیری promise و حالت loading | [📄](docs/packages/suspense.md) + [📄](packages/suspense/README.md) |
| [`@zenith/transition`](packages/transition) | L2 | انیمیشن enter/leave | [📄](docs/packages/transition.md) + [📄](packages/transition/README.md) |
| [`@zenith/virtual-list`](packages/virtual-list) | L2 | رندر ۱۰٬۰۰۰+ آیتم با windowing | [📄](docs/packages/virtual-list.md) + [📄](packages/virtual-list/README.md) |
| [`@zenith/data-table`](packages/data-table) | L2 | جدول reactive با sort/filter | [📄](packages/data-table/README.md) |
| [`@zenith/runtime`](packages/runtime) | L3 | walker، directiveها، hydrate، شیء `Zen` | [📄](packages/runtime/README.md) |
| [`@zenith/ssr`](packages/ssr) | L3 | رندر سرور و استریم | [📄](packages/ssr/README.md) |
| [`@zenith/crud`](packages/crud) | L4 | موتور و اکشن‌های CRUD | [📄](packages/crud/README.md) |
| [`@zenith/stateful`](packages/stateful) | L4 | کامپوننت‌های خودمدیر (loading/error/empty) | [📄](packages/stateful/README.md) |
| [`@zenith/devtools`](packages/devtools) | L4 | hook برای افزونهٔ مرورگر | [📄](packages/devtools/README.md) |
| [`@zenith/service-worker`](packages/service-worker) | L4 | استراتژی‌های cache و sync آفلاین | [📄](packages/service-worker/README.md) |
| [`@zenith/testing`](packages/testing) | L4 | ابزار تست signal/effect/directive | [📄](packages/testing/README.md) |
| [`@zenith/compiler`](packages/compiler) | Tooling | پیش‌کامپایل قالب‌ها | [📄](packages/compiler/README.md) |
| [`@zenith/vite-plugin`](packages/vite-plugin) | Tooling | HMR و تزریق devtools | [📄](packages/vite-plugin/README.md) |
| [`@zenith/cli`](packages/cli) | Tooling | scaffold، `check`، lighthouse | [📄](packages/cli/README.md) |
| [`zenith-vscode`](packages/vscode-extension) | Tooling | پشتیبانی زبان VS Code | [📄](packages/vscode-extension/README.md) |
| [`devtools-extension`](packages/devtools-extension) | Tooling | افزونهٔ مرورگر (Chrome/Firefox) | [📄](packages/devtools-extension/README.md) |

---

## 🧆 معماری در یک نگاه

```
L4 ویژگی‌های سطح‌بالا   crud · stateful · devtools · service-worker · testing
L3 رانتایم DOM / SSR    runtime · ssr
L2 سرویس‌ها و ویژگی‌ها  router · events · components · resource · data · http · actions
                        auth · permission · store · form · notifications · error-boundary
                        suspense · transition · virtual-list · data-table
L1 هستهٔ reactive       state · expressions · dependency-graph
L0 بنیاد                scheduler · errors · security · i18n
```

هر لایه فقط به لایه‌های پایین‌تر وابسته است (gate خودکار: `npm run deps`)؛ چرخه‌های شناخته‌شده و بدهی فنی در [ARCHITECTURE.md §۴](ARCHITECTURE.md) و issueهای #49/#25 ردگیری می‌شوند.

---

## 🛠️ توسعه

```bash
npm ci
npm run lint          # ESLint 9 flat config
npm run typecheck     # noEmit، src-محور (DEC-006)
npm test              # vitest (واحد + اسکریپت‌ها)
npm run build         # esbuild + d.ts در ترتیب گراف وابستگی
npm run size          # size-limit budgets
npm run deps          # dependency-cruiser gate
```

CI کامل (۱۱ job موازی: lint/format/typecheck/unit+coverage/audit/deps/build×Node18/22/publint/size/e2e) در [.github/CI.md](.github/CI.md) مستند است؛ تصمیم‌ها در [docs/decisions/](docs/decisions/).

## 🤝 مشارکت و امنیت

- مشارکت: [docs/README.md](docs/README.md) · گزارش باگ/ویژگی: [Issues](https://github.com/legionir/zenith-v1.4.0/issues) (CONTRIBUTING.md کامل → [#107](https://github.com/legionir/zenith-v1.4.0/issues/107))
- 🔒 **آسیب‌پذیری امنیتی را عمومی report نکنید** → [SECURITY.md](SECURITY.md)
- مراحل دستی باقی‌مانده برای مالکین: [docs/MANUAL-STEPS.md](docs/MANUAL-STEPS.md)

## 📜 مستندات بیشتر

- [راهنمای مهاجرت](docs/migration-guide.md) · [CHANGELOG](docs/CHANGELOG.md)
- [راهنمای LLM/دستیار کدنویسی](docs/LLM-GUIDE.md) · [بنچمارک‌ها](docs/BENCHMARKS.md)
- [معیارهای آماده‌به‌تولید](PRODUCTION-READINESS.md) · [طرح استانداردسازی](STANDARDIZATION-PLAN.md)

## مجوز

[MIT](LICENSE) — © 2026 Zenith Team
