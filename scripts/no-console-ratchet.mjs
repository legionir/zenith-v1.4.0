#!/usr/bin/env node
// #143 — فهرست مجاز مرحله‌ای (ratchet) برای قاعدهٔ ESLint `no-console`.
//
// SPEC §۲.۳ (قانون ESLint): `no-console` برای src همهٔ پکیج‌ها؛ استثنا فقط
// consoleSink داخل @zenith/logger. مهاجرت ۶۲ فایل قدیمی (حدود ۳۷۰ فراخوانی
// console.*) در issue جدا (#39) انجام می‌شود؛ تا آن موقع این فایل *منبع واحد*
// معافیت‌هاست:
//   • eslint.config.mjs این مسیرها را با `no-console: 'off'` override می‌کند.
//   • scripts/test/no-console-ratchet.test.mjs بررسی می‌کند که فهرست دقیقاً
//     برابرِ فایل‌های دارای console در src باشد (نه بیشتر — کهنه، نه کمتر —
//     نقض جدید). یعنی فهرست فقط با مهاجرت کوتاه‌تر می‌شود؛ بزرگ‌کردنش عمدتاً
//     غیرممکن است چون تست، فایلِ بدونِ فهرست را «offender» می‌کند.
//
// مسیرها نسبی به ریشه و با «/» (posix) — همان چیزی که eslint می‌پاید.
export const NO_CONSOLE_RATCHET = [
  'packages/actions/src/registry.ts',
  'packages/auth/src/auth.ts',
  'packages/cli/src/check.ts',
  'packages/cli/src/index.ts',
  'packages/cli/src/lighthouse.ts',
  'packages/cli/src/templates.ts',
  'packages/compiler/src/compiler.ts',
  'packages/components/src/async-loader.ts',
  'packages/components/src/index.ts',
  'packages/components/src/processor.ts',
  'packages/components/src/registry.ts',
  'packages/crud/src/crud-engine.ts',
  'packages/crud/src/crud.ts',
  'packages/data/src/fetcher.ts',
  'packages/devtools/src/api.ts',
  'packages/devtools/src/graph.ts',
  'packages/devtools/src/hook.ts',
  'packages/error-boundary/src/boundary.ts',
  'packages/error-boundary/src/directive.ts',
  'packages/errors/src/index.ts',
  'packages/events/src/delegation.ts',
  'packages/events/src/modifiers.ts',
  'packages/form/src/form.ts',
  'packages/form/src/validator.ts',
  'packages/i18n/src/index.ts',
  'packages/permission/src/directive.ts',
  'packages/permission/src/permission.ts',
  'packages/resource/src/directive.ts',
  'packages/resource/src/resource.ts',
  'packages/router/src/outlet.ts',
  'packages/router/src/router.ts',
  'packages/runtime/src/directives/for.ts',
  'packages/runtime/src/directives/html-trusted.ts',
  'packages/runtime/src/directives/if.ts',
  'packages/runtime/src/directives/intersection.ts',
  'packages/runtime/src/directives/island.ts',
  'packages/runtime/src/directives/memo.ts',
  'packages/runtime/src/directives/model.ts',
  'packages/runtime/src/directives/ref.ts',
  'packages/runtime/src/directives/track.ts',
  'packages/runtime/src/index.ts',
  'packages/runtime/src/walker.ts',
  'packages/scheduler/src/scheduler.ts',
  'packages/security/src/sanitizer.ts',
  'packages/service-worker/src/index.ts',
  'packages/service-worker/src/sw.ts',
  'packages/ssr/src/hydrate.ts',
  'packages/ssr/src/render.ts',
  'packages/ssr/src/server-component.ts',
  'packages/state/src/batch.ts',
  'packages/state/src/effect.ts',
  'packages/state/src/error.ts',
  'packages/state/src/registry.ts',
  'packages/stateful/src/action-button.ts',
  'packages/stateful/src/auth-view.ts',
  'packages/stateful/src/index.ts',
  'packages/stateful/src/resource-view.ts',
  'packages/store/src/store.ts',
  'packages/transition/src/animate.ts',
  'packages/vite-plugin/src/compile.ts',
  'packages/vite-plugin/src/index.ts',
  'packages/vscode-extension/src/extension.ts',
];
