// packages/stateful/src/auth-view.ts
//
// FEATURE (v0.6.0): zen-auth-view — کامپوننت Stateful برای نمایش
// محتوای متمایز بر اساس وضعیت Authentication کاربر.

import type { CustomDirectiveHandler } from '@zenith/runtime';

/**
 * FEATURE (v0.6.0): پردازشگر دایرکتیو zen-auth-view.
 *
 * این تابع دو slot (`authenticated` و `guest`) را بر اساس وضعیت Auth
 * نمایش می‌دهد. وقتی `isAuthenticated` در Auth signal تغییر می‌کند،
 * slot مناسب نمایش داده می‌شود.
 *
 * @param el         عنصر <zen-auth-view>.
 * @param configAttr نام متغیر Auth در state (مثلاً "$auth").
 * @param context    Context والد.
 * @param state      آبجکت State اصلی.
 * @returns تابع Dispose برای پاکسازی Effectها.
 */
export declare function processAuthView(
  el: HTMLElement,
  configAttr: string | null,
  context: Record<string, any>,
  state: Record<string, any>,
): () => void;
//# sourceMappingURL=auth-view.d.ts.map
