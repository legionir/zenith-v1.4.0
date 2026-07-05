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
// ── راه‌اندازی ──
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
// ── طراحی ──
//
// این پلاگین از custom directive registry که در v0.6.0 به walker اضافه شد
// استفاده می‌کند. هنگام نصب، سه تگ سفارشی ثبت می‌شوند. walker هنگام
// پیمایش، اگر به این تگ‌ها برسد، handler مربوطه را فراخوانی می‌کند.

import type { ZenithPlugin } from '@zenith/runtime';
import { registerCustomDirective, hasCustomDirective, unregisterCustomDirective } from '@zenith/runtime';
import { processResourceView } from './resource-view';
import { processActionButton } from './action-button';
import { processAuthView } from './auth-view';

// Re-export توابع پردازشگر برای کاربران پیشرفته‌ای که می‌خواهند بدون
// پلاگین، دستی آنها را ثبت کنند یا در تست‌ها استفاده کنند.
export { processResourceView } from './resource-view';
export { processActionButton } from './action-button';
export { processAuthView } from './auth-view';

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
const statefulDirectives = [
  { name: 'zen-resource-view', handler: processResourceView, attr: 'config' },
  { name: 'zen-action-button', handler: processActionButton, attr: 'action' },
  { name: 'zen-auth-view', handler: processAuthView, attr: 'config' },
];

// BUG-STF-01 FIX: Check for existing directives before registering
// to prevent accidental overwrites (e.g. from a user-registered directive
// with the same name, or double plugin install without idempotency).
export const ZenithStatefulPlugin: ZenithPlugin = {
  name: 'zenith-stateful',

  install(_zen, _options) {
    for (const directive of statefulDirectives) {
      if (hasCustomDirective(directive.name)) {
        console.warn(`[Zenith] Directive "${directive.name}" already registered. Skipping.`);
        continue;
      }
      registerCustomDirective(directive.name, directive.handler, directive.attr);
    }
  },
};

/**
 * تابع راه‌اندازی دستی (برای کاربرانی که نمی‌خواهند از Zen.use استفاده کنند).
 *
 * BUG-STF-02 FIX: حالا یک تابع cleanup برمی‌گرداند که همه‌ی دایرکتیوهای
 * ثبت‌شده را unregister می‌کند — برای HMR و teardown.
 *
 * این تابع همان کار `ZenithStatefulPlugin.install` را انجام می‌دهد اما بدون
 * نیاز به نصب پلاگین. مفید برای محیط‌های تست یا SSR.
 *
 * @returns تابع cleanup: با فراخوانی آن، همه‌ی دایرکتیوهای ثبت‌شده unregister می‌شوند.
 */
export function installStatefulComponents(): () => void {
  const installed: string[] = [];
  for (const directive of statefulDirectives) {
    if (hasCustomDirective(directive.name)) {
      console.warn(`[Zenith] Directive "${directive.name}" already registered. Skipping.`);
      continue;
    }
    registerCustomDirective(directive.name, directive.handler, directive.attr);
    installed.push(directive.name);
  }
  return () => {
    for (const name of installed) {
      unregisterCustomDirective(name);
    }
  };
}
