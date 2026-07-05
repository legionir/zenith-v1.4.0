// packages/stateful/src/resource-view.ts
//
// FEATURE (v0.6.0): zen-resource-view — کامپوننت Stateful برای نمایش
// وضعیت‌های یک Resource (loading / error / empty / success).

import type { CustomDirectiveHandler } from '@zenith/runtime';

/**
 * FEATURE (v0.6.0): پردازشگر دایرکتیو zen-resource-view.
 *
 * این تابع یک Resource (یا هر شیء Resource-like با signal و data) را مدیریت
 * می‌کند و به‌صورت خودکار وضعیت‌های loading / error / empty / success را
 * نمایش می‌دهد.
 *
 * @param el         عنصر <zen-resource-view>.
 * @param configAttr نام متغیر Resource در state (مثلاً "$usersResource").
 * @param context    Context والد.
 * @param state      آبجکت State اصلی.
 * @returns تابع Dispose برای پاکسازی Effectها.
 */
export declare function processResourceView(
  el: HTMLElement,
  configAttr: string | null,
  context: Record<string, any>,
  state: Record<string, any>,
): () => void;
//# sourceMappingURL=resource-view.d.ts.map
