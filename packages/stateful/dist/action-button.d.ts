// packages/stateful/src/action-button.ts
//
// FEATURE (v0.6.0): zen-action-button — کامپوننت دکمه‌ی Stateful.

import type { CustomDirectiveHandler } from '@zenith/runtime';

/**
 * FEATURE (v0.6.0): پردازشگر دایرکتیو zen-action-button.
 *
 * این تابع یک دکمه را به یک action متصل می‌کند و به‌صورت خودکار loading
 * state را هنگام اجرای async action مدیریت می‌کند (disabled + loading text).
 *
 * @param el         عنصر <zen-action-button> یا <button>.
 * @param configAttr نام action (از attribute `action`).
 * @param context    Context والد.
 * @param state      آبجکت State اصلی.
 * @returns تابع Dispose برای پاکسازی listenerها.
 */
export declare function processActionButton(
  el: HTMLElement,
  configAttr: string | null,
  context: Record<string, any>,
  state: Record<string, any>,
): () => void;
//# sourceMappingURL=action-button.d.ts.map
