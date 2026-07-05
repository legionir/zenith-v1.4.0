// packages/ssr/src/dom-context.ts
//
// FEATURE (v1.0.0): AsyncLocalStorage-based DOM globals isolation.
//
// مشکل (race condition در SSR concurrent):
//   در نسخه‌های قبلی، `renderToString` برای نصب `window`, `document`,
//   `Node`, `HTMLElement`, `Element`, `Event`, `history`, `location`,
//   `DOMParser`, `MouseEvent`, `KeyboardEvent` از JSDOM، مستقیماً
//   `globalThis[g] = dom.window[g]` را set و در `finally` restore می‌کرد.
//   این کار در SSR concurrent (مثلاً ۱۰۰ درخواست همزمان) باعث race
//   condition می‌شد: درخواست A globals خود را set می‌کرد، سپس درخواست B
//   قبل از اتمام A، globals خود را overwrite می‌کرد. حتی با بخش بحرانی
//   synchronous، `dom.window.close()` در `finally` می‌توانست روی DOM
//   درخواست دیگری که هنوز در حال خواندن globals بود تأثیر بگذارد.
//
// راه‌حل:
//   هر درخواست SSR globals خود را در یک AsyncLocalStorage store مستقل
//   ذخیره می‌کند. سپس `globalThis.document` و سایر globals به‌عنوان
//   getter تعریف می‌شوند که از store فعلی (بر اساس async context) می‌خوانند.
//   این کار به هر درخواست DOM مستقل خود را می‌دهد بدون اینکه globals
//   سراسری overwrite شوند. concurrent درخواست‌ها کاملاً ایزوله‌اند.
//
// Browser-safe:
//   در مرورگر (که `document` از قبل تعریف شده)، این ماژول هیچ تغییری روی
//   globalThis ایجاد نمی‌کند. getters فقط در Node.js (جایی که `document`
//   تعریف نشده) نصب می‌شوند. این رفتار در `installDOMGlobalGetters` با
//   `if (typeof document !== 'undefined') return;` تضمین می‌شود.
//
// Idempotent:
//   نصب getters یک‌بار با flag `_installed` انجام می‌شود. فراخوانی مجدد
//   `installDOMGlobalGetters` no-op است. همچنین auto-install هنگام import
//   ماژول در Node یک‌بار انجام می‌شود.

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * FEATURE (v1.0.0): مجموعه‌ی globals که SSR به آن‌ها نیاز دارد.
 *
 * این‌ها مقادیری هستند که JSDOM روی `dom.window` فراهم می‌کند و runtime
 * در حین رندر به آن‌ها ارجاع می‌دهد (مثلاً `document.createComment`).
 *
 * این interface توسط `renderToString` پر می‌شود و در `domAls.run` به‌عنوان
 * store ذخیره می‌شود.
 */
export interface DOMGlobals {
  window: any;
  document: any;
  Node: any;
  HTMLElement: any;
  Element: any;
  Event: any;
  history: any;
  location: any;
  DOMParser: any;
  MouseEvent: any;
  KeyboardEvent: any;
}

/**
 * FEATURE (v1.0.0): AsyncLocalStorage برای isolation per-request.
 *
 * هر درخواست SSR یک store مستقل دارد که شامل DOM globals مربوط به همان
 * درخواست است. این store از طریق async context (Promise chain, callbacks,
 * await) به‌صورت خودکار propagate می‌شود — نیازی به پاس‌کردن دستی نیست.
 *
 * این الگو مشابه `cls-hooked` یا NestJS `ClsService` است.
 */
const domAls = new AsyncLocalStorage<DOMGlobals>();
export { domAls };

/**
 * FEATURE (v1.0.0): گرفتن DOM globals مربوط به async context فعلی.
 *
 * اگر خارج از `domAls.run()` فراخوانی شود (مثلاً در browser یا Node بدون
 * SSR فعال)، `undefined` برمی‌گرداند.
 *
 * این تابع توسط getterهای `globalThis` (که در `installDOMGlobalGetters`
 * نصب می‌شوند) فراخوانی می‌شود تا مقدار صحیح برای async context فعلی
 * برگردانده شود.
 */
export function getDOMGlobals(): DOMGlobals | undefined {
  return domAls.getStore();
}

/**
 * FEATURE (v1.0.0): لیست کلیدهایی که به‌عنوان getter روی globalThis نصب
 * می‌شوند.
 *
 * این‌ها همان کلیدهایی هستند که runtime در حین رندر به آن‌ها ارجاع می‌دهد
 * (مستقیم یا از طریق `globalThis`). ترتیب اهمیتی ندارد.
 */
const GLOBAL_KEYS = [
  'window',
  'document',
  'Node',
  'HTMLElement',
  'Element',
  'Event',
  'history',
  'location',
  'DOMParser',
  'MouseEvent',
  'KeyboardEvent',
] as const;

/**
 * FEATURE (v1.0.0): flag برای جلوگیری از نصب مکرر getters.
 *
 * یک‌بار نصب کافی است چون getters از AsyncLocalStorage می‌خوانند و
 * خودشان context-aware هستند (مقدار بر اساس async context فعلی برگردانده
 * می‌شود، نه یک snapshot).
 */
let _installed = false;

/**
 * FEATURE (v1.0.0): نصب getters روی globalThis برای delegation به
 * AsyncLocalStorage.
 *
 * این تابع:
 *   - **idempotent** است: اگر قبلاً نصب شده باشد، no-op است (flag `_installed`).
 *   - **browser-safe** است: در مرورگر (که `document` از قبل تعریف شده) no-op
 *     است تا behavior طبیعی مرورگر دست‌نخورده بماند.
 *   - مقادیر native قبلی (مثلاً Node's `Event` در Node 18+) را قبل از override
 *     capture می‌کند تا وقتی SSR فعال نیست، getter همان مقدار native را برگرداند.
 *     این کار از شکستن کدهایی که به `Event` سراسری Node وابسته‌اند جلوگیری می‌کند.
 *
 * نکته: getters با `configurable: true` تعریف می‌شوند تا اگر در آینده نیاز
 * به override یا حذف شد، قابل جایگزینی باشند.
 *
 * نکته: این تابع به‌صورت خودکار هنگام import ماژول (در Node) فراخوانی
 * می‌شود (در انتهای فایل). کاربر نیازی به فراخوانی دستی ندارد، اما اگر
 * بخواهد می‌تواند فراخوانی کند (idempotent است).
 */
export function installDOMGlobalGetters(): void {
  if (_installed) return;
  // در مرورگر، document از قبل وجود دارد — globalThis را دست نزن.
  if (typeof document !== 'undefined') return;
  _installed = true;
  for (const key of GLOBAL_KEYS) {
    // FEATURE (v1.0.0): capture مقدار native قبل از override.
    // برای کلیدهایی که در Node وجود ندارند (مثل `document`, `window`) این
    // مقدار undefined است. برای کلیدهایی که در Node 18+ وجود دارند (مثل
    // `Event`) این مقدار کلاس native است و وقتی SSR فعال نیست برگردانده
    // می‌شود تا behavior سراسری Node حفظ شود.
    const nativeValue = (globalThis as any)[key];
    Object.defineProperty(globalThis, key, {
      get() {
        const store = getDOMGlobals();
        // اگر در async context یک SSR فعال است، globals آن درخواست را برگردان.
        // در غیر این صورت، مقدار native (که می‌تواند undefined باشد) را برگردان.
        return store ? store[key as keyof DOMGlobals] : nativeValue;
      },
      configurable: true,
      enumerable: true,
    });
  }
}

// FEATURE (v1.0.0): auto-install هنگام import ماژول (فقط در Node).
// در مرورگر، `document` از قبل تعریف شده و `installDOMGlobalGetters` no-op
// است (به‌خاطر guard `typeof document !== 'undefined'` در ابتدای تابع).
// این کار باعث می‌شود بدون نیاز به فراخوانی دستی، getters قبل از اولین
// renderToString نصب شوند.
if (typeof document === 'undefined') {
  installDOMGlobalGetters();
}
