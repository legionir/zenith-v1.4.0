// packages/ssr/src/dom-context.ts
//
// FEATURE (v1.0.0): AsyncLocalStorage-based DOM globals isolation.
//
// تعاریف TypeScript برای DOM globals isolation در SSR.

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
 *
 * @example
 *   import { domAls } from '@zenith/ssr';
 *   const globals: DOMGlobals = { window: dom.window, document: dom.window.document, ... };
 *   await domAls.run(globals, () => doRender());
 */
export declare const domAls: AsyncLocalStorage<DOMGlobals>;

/**
 * FEATURE (v1.0.0): گرفتن DOM globals مربوط به async context فعلی.
 *
 * اگر خارج از `domAls.run()` فراخوانی شود (مثلاً در browser یا Node بدون
 * SSR فعال)، `undefined` برمی‌گرداند.
 *
 * این تابع توسط getterهای `globalThis` (که در `installDOMGlobalGetters`
 * نصب می‌شوند) فراخوانی می‌شود تا مقدار صحیح برای async context فعلی
 * برگردانده شود.
 *
 * @returns DOM globals برای async context فعلی، یا `undefined` اگر فعال نیست.
 *
 * @example
 *   import { getDOMGlobals } from '@zenith/ssr';
 *   const globals = getDOMGlobals();
 *   if (globals) {
 *     globals.document.createComment('test');
 *   }
 */
export declare function getDOMGlobals(): DOMGlobals | undefined;

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
 *
 * @example
 *   import { installDOMGlobalGetters } from '@zenith/ssr';
 *   // معمولاً نیازی به فراخوانی دستی نیست — هنگام import ماژول نصب می‌شود.
 *   installDOMGlobalGetters(); // idempotent — safe to call multiple times.
 */
export declare function installDOMGlobalGetters(): void;
//# sourceMappingURL=dom-context.d.ts.map
