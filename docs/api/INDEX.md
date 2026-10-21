# مرجع کامل API پکیج‌های Zenith (`#56`, `#103`)

این فهرست به‌صورت خودکار از روی AST و TSDoc تمام ۴۳ پکیج TypeScript فریم‌ورک Zenith تولید شده است.

| پکیج | محیط هدف (`zenith.target`) | تعداد نمادهای عمومی | صفحهٔ مرجع API |
|------|----------------------------|---------------------|----------------|
| `@zenith/actions` | `universal` | 15 | [actions.md](./actions.md) |
| `@zenith/auth` | `universal` | 43 | [auth.md](./auth.md) |
| `@zenith/auth-oauth` | `universal` | 23 | [auth-oauth.md](./auth-oauth.md) |
| `@zenith/cache` | `universal` | 19 | [cache.md](./cache.md) |
| `@zenith/charts` | `universal` | 11 | [charts.md](./charts.md) |
| `@zenith/cli` | `node` | 1 | [cli.md](./cli.md) |
| `@zenith/codemod` | `node` | 14 | [codemod.md](./codemod.md) |
| `@zenith/compiler` | `universal` | 19 | [compiler.md](./compiler.md) |
| `@zenith/components` | `browser` | 22 | [components.md](./components.md) |
| `@zenith/create-zenith` | `node` | 15 | [create-zenith.md](./create-zenith.md) |
| `@zenith/crud` | `universal` | 6 | [crud.md](./crud.md) |
| `@zenith/data` | `universal` | 18 | [data.md](./data.md) |
| `@zenith/data-table` | `browser` | 11 | [data-table.md](./data-table.md) |
| `@zenith/dependency-graph` | `universal` | 5 | [dependency-graph.md](./dependency-graph.md) |
| `@zenith/devtools` | `browser` | 44 | [devtools.md](./devtools.md) |
| `@zenith/devtools-core` | `universal` | 54 | [devtools-core.md](./devtools-core.md) |
| `@zenith/error-boundary` | `browser` | 20 | [error-boundary.md](./error-boundary.md) |
| `@zenith/errors` | `universal` | 56 | [errors.md](./errors.md) |
| `@zenith/events` | `browser` | 27 | [events.md](./events.md) |
| `@zenith/expressions` | `universal` | 29 | [expressions.md](./expressions.md) |
| `@zenith/feature-flags` | `universal` | 13 | [feature-flags.md](./feature-flags.md) |
| `@zenith/form` | `universal` | 51 | [form.md](./form.md) |
| `@zenith/http` | `universal` | 39 | [http.md](./http.md) |
| `@zenith/i18n` | `universal` | 62 | [i18n.md](./i18n.md) |
| `@zenith/icons` | `universal` | 12 | [icons.md](./icons.md) |
| `@zenith/jalali` | `universal` | 32 | [jalali.md](./jalali.md) |
| `@zenith/language-server` | `node` | 96 | [language-server.md](./language-server.md) |
| `@zenith/logger` | `universal` | 23 | [logger.md](./logger.md) |
| `@zenith/notifications` | `browser` | 34 | [notifications.md](./notifications.md) |
| `@zenith/permission` | `universal` | 16 | [permission.md](./permission.md) |
| `@zenith/resource` | `universal` | 16 | [resource.md](./resource.md) |
| `@zenith/router` | `universal` | 31 | [router.md](./router.md) |
| `@zenith/runtime` | `browser` | 175 | [runtime.md](./runtime.md) |
| `@zenith/runtime-core` | `universal` | 40 | [runtime-core.md](./runtime-core.md) |
| `@zenith/scheduler` | `universal` | 20 | [scheduler.md](./scheduler.md) |
| `@zenith/schema` | `universal` | 31 | [schema.md](./schema.md) |
| `@zenith/security` | `universal` | 12 | [security.md](./security.md) |
| `@zenith/service-worker` | `worker` | 23 | [service-worker.md](./service-worker.md) |
| `@zenith/shared` | `universal` | 23 | [shared.md](./shared.md) |
| `@zenith/ssr` | `node` | 74 | [ssr.md](./ssr.md) |
| `@zenith/state` | `universal` | 68 | [state.md](./state.md) |
| `@zenith/stateful` | `browser` | 5 | [stateful.md](./stateful.md) |
| `@zenith/storage` | `universal` | 32 | [storage.md](./storage.md) |
| `@zenith/store` | `universal` | 17 | [store.md](./store.md) |
| `@zenith/suspense` | `universal` | 13 | [suspense.md](./suspense.md) |
| `@zenith/templates` | `node` | 27 | [templates.md](./templates.md) |
| `@zenith/testing` | `universal` | 31 | [testing.md](./testing.md) |
| `@zenith/theme` | `universal` | 16 | [theme.md](./theme.md) |
| `@zenith/transition` | `browser` | 27 | [transition.md](./transition.md) |
| `@zenith/unplugin-zenith` | `node` | 37 | [unplugin-zenith.md](./unplugin-zenith.md) |
| `@zenith/virtual-list` | `browser` | 15 | [virtual-list.md](./virtual-list.md) |
| `@zenith/vite-plugin` | `node` | 17 | [vite-plugin.md](./vite-plugin.md) |
| `zenith` | `universal` | 47 | [zenith.md](./zenith.md) |

## زیرمسیرهای عمومی (subpath entry points؛ #142/#120)

این زیرمسیرها بخشی از API عمومی‌اند و در `api-surface.snapshot.json` هم
با کلید خودشان (`@zenith/schema/attr` و …) ثبت شده‌اند تا حذف/افزودن
ناخواسته در CI قرمز شود.

| زیرمسیر | محیط هدف (`zenith.target`) | تعداد نمادهای عمومی | صفحهٔ مرجع API |
|---------|----------------------------|---------------------|----------------|
| `@zenith/cli/program` | `node` | 2 | [cli--program.md](./cli--program.md) |
| `@zenith/schema/zod` | `universal` | 3 | [schema--zod.md](./schema--zod.md) |
| `@zenith/schema/json-schema` | `universal` | 2 | [schema--json-schema.md](./schema--json-schema.md) |
| `@zenith/schema/attr` | `universal` | 4 | [schema--attr.md](./schema--attr.md) |
| `@zenith/storage/signal` | `universal` | 3 | [storage--signal.md](./storage--signal.md) |
| `@zenith/unplugin-zenith/vite` | `node` | 2 | [unplugin-zenith--vite.md](./unplugin-zenith--vite.md) |
| `@zenith/unplugin-zenith/rollup` | `node` | 1 | [unplugin-zenith--rollup.md](./unplugin-zenith--rollup.md) |
| `@zenith/unplugin-zenith/webpack` | `node` | 1 | [unplugin-zenith--webpack.md](./unplugin-zenith--webpack.md) |
| `@zenith/unplugin-zenith/esbuild` | `node` | 1 | [unplugin-zenith--esbuild.md](./unplugin-zenith--esbuild.md) |
| `@zenith/unplugin-zenith/rspack` | `node` | 1 | [unplugin-zenith--rspack.md](./unplugin-zenith--rspack.md) |
| `zenith/core` | `universal` | 38 | [zenith--core.md](./zenith--core.md) |
| `zenith/ssr` | `universal` | 0 | [zenith--ssr.md](./zenith--ssr.md) |
| `zenith/testing` | `universal` | 0 | [zenith--testing.md](./zenith--testing.md) |
| `zenith/presets/minimal` | `universal` | 9 | [zenith--presets-minimal.md](./zenith--presets-minimal.md) |
| `zenith/presets/spa` | `universal` | 16 | [zenith--presets-spa.md](./zenith--presets-spa.md) |
| `zenith/presets/full` | `universal` | 16 | [zenith--presets-full.md](./zenith--presets-full.md) |
| `zenith/browser` | `universal` | 22 | [zenith--browser.md](./zenith--browser.md) |

