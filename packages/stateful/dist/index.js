// packages/stateful/src/index.ts
//
// FEATURE (v0.6.0): نقطه‌ی ورود پکیج `@zenith/stateful`.
//
// این پکیج سه کامپوننت Stateful سطح بالا ارائه می‌دهد:
//   1. zen-resource-view — مدیریت کامل وضعیت‌های یک Resource
//      (loading / error / empty / success) با retry خودکار.
//   2. zen-action-button — دکمه‌ای که loading state را هنگام اجرای
//      async action به‌صورت خودکار مدیریت می‌کند.
//   3. zen-auth-view — نمایش محتوای متمایز بر اساس وضعیت Authentication
//      کاربر (authenticated / guest).
//
// ─ـ راه‌اندازی ──
//
//   import { Zen } from '@zenith/runtime';
//   import { ZenithStatefulPlugin } from '@zenith/stateful';
//
//   // نصب پلاگین (یک‌بار در ابتدای اپ).
//   Zen.use(ZenithStatefulPlugin);
//
//   // سپس در HTML می‌توان از تگ‌های زیر استفاده کرد:
//   //   <zen-resource-view config="$usersResource">...</zen-resource-view>
//   //   <zen-action-button action="save" loading-text="...">ذخیره</zen-action-button>
//   //   <zen-auth-view config="$auth">...</zen-auth-view>
//
// ─ـ طراحی ─ـ
//
// این پلاگین از custom directive registry که در v0.6.0 به walker اضافه شد
// استفاده می‌کند. هنگام نصب، سه تگ سفارشی ثبت می‌شوند. walker هنگام
// پیمایش، اگر به این تگ‌ها برسد، handler مربوطه را فراخوانی می‌کند.

import { registerCustomDirective } from '@zenith/runtime';
import { processResourceView } from './resource-view.js';
import { processActionButton } from './action-button.js';
import { processAuthView } from './auth-view.js';

// Re-export توابع پردازشگر برای کاربران پیشرفته‌ای که می‌خواهند بدون
// پلاگین، دستی آنها را ثبت کنند یا در تست‌ها استفاده کنند.
export { processResourceView } from './resource-view.js';
export { processActionButton } from './action-button.js';
export { processAuthView } from './auth-view.js';

/**
 * FEATURE (v0.6.0): پلاگین Stateful Components.
 *
 * این پلاگین سه تگ سفارشی را در custom directive registry ثبت می‌کند:
 *
 *   1. `<zen-resource-view config="$varName">` — مدیریت وضعیت‌های Resource.
 *      attributeName: `'config'` (مثلاً `config="$usersResource"`).
 *
 *   2. `<zen-action-button action="save" loading-text="...">` — دکمه‌ی
 *      Stateful با loading خودکار.
 *      attributeName: `'action'` (مثلاً `action="save"`).
 *
 *   3. `<zen-auth-view config="$auth">` — نمایش محتوای authenticated/guest.
 *      attributeName: `'config'` (مثلاً `config="$auth"`).
 *
 * نمونه‌ی استفاده:
 *
 *   import { Zen } from '@zenith/runtime';
 *   import { ZenithStatefulPlugin } from '@zenith/stateful';
 *   Zen.use(ZenithStatefulPlugin);
 *
 * نکته: نصب این پلاگین idempotent است (به‌واسطه‌ی `Zen.use`). اگر دوباره
 * نصب شود، فقط warning می‌دهد و no-op است.
 */
export const ZenithStatefulPlugin = {
    name: 'zenith-stateful',
    install(_zen, _options) {
        // ── ثبت سه تگ سفارشی ──
        // attributeName مشخص می‌کند که کدام attribute تگ، به‌عنوان `configAttr`
        // به handler پاس داده شود.
        //
        // برای zen-resource-view و zen-auth-view: `config="$varName"`.
        // برای zen-action-button: `action="save"`.
        registerCustomDirective('zen-resource-view', processResourceView, 'config');
        registerCustomDirective('zen-action-button', processActionButton, 'action');
        registerCustomDirective('zen-auth-view', processAuthView, 'config');
    },
};

/**
 * تابع راه‌اندازی دستی (برای کاربرانی که نمی‌خواهند از Zen.use استفاده کنند).
 *
 * این تابع همان کار `ZenithStatefulPlugin.install` را انجام می‌دهد اما بدون
 * نیاز به نصب پلاگین. مفید برای محیط‌های تست یا SSR.
 */
export function installStatefulComponents() {
    registerCustomDirective('zen-resource-view', processResourceView, 'config');
    registerCustomDirective('zen-action-button', processActionButton, 'action');
    registerCustomDirective('zen-auth-view', processAuthView, 'config');
}
//# sourceMappingURL=index.js.map
