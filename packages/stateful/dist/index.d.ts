// packages/stateful/src/index.ts
//
// FEATURE (v0.6.0): نقطه‌ی ورود پکیج `@zenith/stateful`.
//
// این پکیج سه کامپوننت Stateful سطح بالا ارائه می‌دهد:
//   1. zen-resource-view — مدیریت کامل وضعیت‌های یک Resource
//   2. zen-action-button — دکمه‌ای که loading state را هنگام اجرای async action مدیریت می‌کند
//   3. zen-auth-view — نمایش محتوای متمایز بر اساس وضعیت Authentication

import type { ZenithPlugin, CustomDirectiveHandler } from '@zenith/runtime';

export { processResourceView } from './resource-view';
export { processActionButton } from './action-button';
export { processAuthView } from './auth-view';

/**
 * FEATURE (v0.6.0): پلاگین Stateful Components.
 *
 * این پلاگین سه تگ سفارشی را در custom directive registry ثبت می‌کند:
 *
 *   1. `<zen-resource-view config="$varName">` — مدیریت وضعیت‌های Resource.
 *   2. `<zen-action-button action="save" loading-text="...">` — دکمه‌ی Stateful.
 *   3. `<zen-auth-view config="$auth">` — نمایش محتوای authenticated/guest.
 *
 * @example
 *   import { Zen } from '@zenith/runtime';
 *   import { ZenithStatefulPlugin } from '@zenith/stateful';
 *   Zen.use(ZenithStatefulPlugin);
 */
export declare const ZenithStatefulPlugin: ZenithPlugin;

/**
 * تابع راه‌اندازی دستی (برای کاربرانی که نمی‌خواهند از Zen.use استفاده کنند).
 *
 * این تابع همان کار `ZenithStatefulPlugin.install` را انجام می‌دهد اما بدون
 * نیاز به نصب پلاگین. مفید برای محیط‌های تست یا SSR.
 */
export declare function installStatefulComponents(): void;
//# sourceMappingURL=index.d.ts.map
