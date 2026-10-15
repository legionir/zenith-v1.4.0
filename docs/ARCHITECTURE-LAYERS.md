# لایه‌های معماری Zenith (`L0`–`L5` + `Tooling`)

> **وضعیت:** مصوب و قفل‌شده در CI با `.dependency-cruiser.cjs` (`#48`، `#49`، `NEW-PACKAGES-SPEC.md` §1).

---

## ۱. اصل کلی جهت وابستگی‌ها

هر پکیج در فضای کاری `packages/*` دقیقاً در یکی از لایه‌های زیر قرار می‌گیرد.
**قاعدهٔ طلایی:** پکیج در لایهٔ $L_i$ فقط مجاز است به پکیج‌های لایهٔ $L_j$ با $j \le i$ وابسته باشد و هیچ چرخهٔ استاتیکی (`no-circular`) در گراف وابستگی مجاز نیست.

```
L5 (Umbrella)     zenith
                    │
L4 (Integrations) stateful · crud · service-worker · devtools · testing
                  (+ adapter-node · adapter-edge · ssg)
                    │
L3 (Runtime/SSR)  runtime-core · ssr · runtime (compat facade)
                    │
L2 (Capabilities) router · events · components · resource · data · http · actions
                  auth · permission · store · form · notifications · error-boundary
                  suspense · transition · virtual-list · data-table · i18n
                  (+ a11y · head · ui · realtime · analytics · theme · auth-oauth · feature-flags · charts · icons)
                    │
L1 (Reactivity)   state · expressions · dependency-graph · devtools-core
                    │
L0 (Foundation)   errors → shared → {logger, cache, jalali} → {storage, schema}
                  + scheduler · security

Tooling (Build/DX) compiler · vite-plugin · cli · vscode-extension · devtools-extension
                   (+ unplugin-zenith · create-zenith · eslint-plugin · language-server · codemod · mock · testing-e2e)
```

---

## ۲. جدول لایه‌ها و پکیج‌ها

| لایه | پکیج‌ها | مجاز به import از | ممنوعیت‌ها |
|---|---|---|---|
| **L0 — Foundation** | `errors`, `shared`, `logger`, `cache`, `jalali`, `storage`, `schema`, `scheduler`, `security` | فقط `L0` (با حفظ DAG درونی: `errors` بدون وابستگی؛ `shared` فقط `errors`) | هرگونه import از `L1..L5` و `Tooling` |
| **L1 — Reactivity & Core AST** | `state`, `expressions`, `dependency-graph`, `devtools-core` | `L0`, `L1` (`state` بدون یال خروجی به پکیج‌های جدید طبق `DEC-021`) | هرگونه import از `L2..L5` و `Tooling` (از جمله `state -> devtools`) |
| **L2 — Capabilities** | `router`, `events`, `components`, `resource`, `data`, `http`, `actions`, `auth`, `permission`, `store`, `form`, `notifications`, `error-boundary`, `suspense`, `transition`, `virtual-list`, `data-table`, `i18n` | `L0`, `L1`, `L2` | هرگونه import از `L3..L5` و `Tooling`؛ یال معکوس `events -> router` ممنوع است (`#48`) |
| **L3 — Runtime & SSR** | `runtime-core`, `ssr`, `runtime` | `L0`, `L1`, `L2`, `L3` | هرگونه import از `L4..L5` و `Tooling` (به‌جز بازصادرات سازگاری میراث `runtime -> devtools` تا v2.0)؛ یال `runtime -> i18n` ممنوع است (`#48`، `#146`) |
| **L4 — High-Level & Testing** | `stateful`, `crud`, `service-worker`, `devtools`, `testing` | `L0` تا `L4` | هرگونه import از `L5` (`zenith`) و `Tooling` |
| **L5 — Umbrella** | `zenith` | `L0` تا `L5` | هرگونه import از `Tooling` |
| **Tooling** | `compiler`, `vite-plugin`, `cli`, `vscode-extension` | ابزارهای ساخت و تحلیل؛ هیچ پکیج زمان اجرا (`L0..L5`) نباید به `Tooling` وابسته باشد | ورود به باندل زمان اجرا (`L0..L5 -> Tooling` ممنوع) |

---

## ۳. وابستگی‌های معکوس حذف‌شده (`#48`)

1. **`state -> devtools` (حذف‌شده در `#147`):**
   `@zenith/state` دیگر به `@zenith/devtools` وابسته نیست و تنها قلاب سبک `setSignalObserver` را صادر می‌کند که `@zenith/devtools-core` (`L1`) به آن متصل می‌شود.
2. **`events -> router` (حذف‌شده در `#48`):**
   `@zenith/events` دیگر `navigate` را از `@zenith/router` وارد نمی‌کند؛ به‌جای آن قلاب `setLinkNavigationHandler` را صادر می‌کند که در `@zenith/runtime` متصل می‌شود.
3. **`runtime -> i18n` (حذف‌شده در `#146` / `#48`):**
   دایرکتیو `zen-date-picker` در `@zenith/runtime` مستقیماً از `@zenith/jalali` (`L0`) استفاده می‌کند و هیچ وابستگی به `@zenith/i18n` ندارد.

---

## ۴. اجرای خودکار در CI

فایل `.dependency-cruiser.cjs` در گام `npm run check:deps` (`npx depcruise --config .dependency-cruiser.cjs packages`) قوانین زیر را روی تمام فایل‌های `packages/*/src` بررسی و قفل می‌کند:
- `no-circular`
- `not-to-dev-dep`
- `no-events-to-router` (`#48`)
- `no-state-to-devtools` (`#48`)
- `no-runtime-to-i18n` (`#48`)
- `layer-l0-no-upward` (`#49`)
- `layer-l1-no-upward` (`#49`)
- `layer-l2-no-upward` (`#49`)
- `layer-l3-no-upward` (`#49`)
- `layer-l4-no-upward` (`#49`)
- `no-runtime-to-tooling` (`#49`)
