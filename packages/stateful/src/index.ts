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
import { logger } from '@zenith/logger';
import { deprecate } from '@zenith/errors';
import {
  registerCustomDirective,
  hasCustomDirective,
  unregisterCustomDirective,
} from '@zenith/runtime';
import { processResourceView } from './resource-view';
import { processActionButton } from './action-button';
import { processAuthView } from './auth-view';

// Re-export توابع پردازشگر برای کاربران پیشرفته‌ای که می‌خواهند بدون
// پلاگین، دستی آنها را ثبت کنند یا در تست‌ها استفاده کنند.
/** @public */
export { processResourceView } from './resource-view';
/** @public */
export { processActionButton } from './action-button';
/** @public */
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
 *
 * @public
 */
const statefulDirectives = [
  { name: 'zen-resource-view', handler: processResourceView, attr: 'config' },
  { name: 'zen-action-button', handler: processActionButton, attr: 'action' },
  { name: 'zen-auth-view', handler: processAuthView, attr: 'config' },
];

// BUG-STF-01 FIX: Check for existing directives before registering
// to prevent accidental overwrites (e.g. from a user-registered directive
// with the same name, or double plugin install without idempotency).
//
// #117 — تک‌مسیر نصب: پیاده‌سازی واقعی اینجاست (registerStatefulDirectives)؛
// `ZenithStatefulPlugin.install` تنها مسیر canonical است (`Zen.use(...)`) و
// `installStatefulComponents()` alias منسوخ‌شونده‌ای است که به همان توابع
// داخلی delegate می‌کند (ZEN-DEPR-026؛ حذف در ۲.۰ — DEC-026).
function registerStatefulDirectives(): {
  installed: string[];
  unregister: () => void;
} {
  const installed: string[] = [];
  for (const directive of statefulDirectives) {
    if (hasCustomDirective(directive.name)) {
      // #117: تنها مسیر نصب ⇒ تنها یک نقطهٔ هشدار (قبلاً دو کپی یکسان داشت).
      logger.warn(`[Zenith] Directive "${directive.name}" already registered. Skipping.`);
      continue;
    }
    registerCustomDirective(directive.name, { handler: directive.handler, attributeName: directive.attr });
    installed.push(directive.name);
  }
  return {
    installed,
    unregister: () => {
      for (const name of installed) {
        unregisterCustomDirective(name);
      }
    },
  };
}

/** Stateful components plugin for `Zen.use(...)`. @public */
export const ZenithStatefulPlugin: ZenithPlugin = {
  name: 'zenith-stateful',

  install(_zen, _options) {
    registerStatefulDirectives();
  },
};

/**
 * @public @deprecated #117 — یک مسیر نصب برای stateful: `Zen.use(ZenithStatefulPlugin)`.
 * این تابع همان ثبت‌ها را انجام می‌دهد (delegate به پیاده‌سازی مشترک) و یک
 * `Cleanup` (`() => void`) idempotent برای unregister برمی‌گرداند؛ یک‌بار
 * ZEN-DEPR-026 هشدار می‌دهد و در ۲.۰ حذف می‌شود (DEC-026).
 *
 * مسیر Canonical:
 *   import { Zen } from '@zenith/runtime';
 *   import { ZenithStatefulPlugin } from '@zenith/stateful';
 *   Zen.use(ZenithStatefulPlugin);
 */
export function installStatefulComponents(): () => void {
  deprecate('ZEN-DEPR-026', 'installStatefulComponents()', 'Zen.use(ZenithStatefulPlugin)');
  const { unregister } = registerStatefulDirectives();
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    unregister();
  };
}
