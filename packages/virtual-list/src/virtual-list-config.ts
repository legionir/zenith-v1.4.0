// packages/virtual-list/src/virtual-list-config.ts
//
// کانفیگ قدیمی و تایپ‌های کنترلر — استخراج مکانیکی از virtual-list.ts،
// بدون تغییر رفتار (#40).

import type { VirtualItemSize, VirtualListDirection, VirtualListOptions } from './controller';


// ── Types (قرارداد عمومی پکیج) ──

/**
 * @deprecated از `VirtualListOptions<T>` API مبنا استفاده کنید (#47، ZEN-DEPR-001).
 *
 * یکی‌سازی #47: این تایپ دیگر ساختار مستقلی نیست — صرفاً نمای قدیمی
 * (`itemHeight`/`buffer`) از فیلدهای مشترک `VirtualListOptions` است و
 * type-check تضمین می‌کند هر وقت دو طرف واگرا شوند اینجا می‌شکند.
 * ترجمهٔ اجرایی با `virtualListConfigToOptions` انجام می‌شود.
 */
export interface VirtualListConfig {
  itemHeight: number;
  buffer: number;
  /** فقط wrapper مصرف می‌کند (measure/height style) — خارج از options موتور. */
  dynamicHeights: boolean;
  direction: 'vertical' | 'horizontal';
  /** فقط wrapper مصرف می‌کند (انیمیشن mount/unmount آیتم). */
  animateMount: string | null;
  animateUnmount: string | null;
}

/**
 * #47 — پل نوعی: فیلدهای مشترک config قدیمی باید هم‌نوع با options موتور
 * بمانند (itemHeight:number ↔ itemSize شامل number، buffer:number ↔
 * overscan?: number، direction ↔ VirtualListDirection). واگرایی = خطای compile.
 */
const _configUnified: {
  itemHeight: number extends VirtualItemSize<unknown> ? true : false;
  buffer: number extends NonNullable<VirtualListOptions<unknown>['overscan']> ? true : false;
  direction: 'vertical' | 'horizontal' extends VirtualListDirection ? true : false;
} = { itemHeight: true, buffer: true, direction: true };
void _configUnified;

/**
 * @deprecated ترجیحاً `createVirtualList(VirtualListOptions<T>)` مستقیم؛ این
 * helper همان پل config→options است که داخل wrapper دایرکتیو هم استفاده می‌شود
 * تا فقط یک مسیر ترجمه وجود داشته باشد (#47 — «یکی کردن VirtualListConfig و
 * VirtualListOptions<T>»). فیلدهای فقط-wrapper (dynamicHeights/animateMount/
 * animateUnmount) به options موتور ترجمه نمی‌شوند؛ موتور از آن‌ها بی‌خبر است.
 */
export function virtualListConfigToOptions<
  T,
  B extends Pick<VirtualListOptions<T>, 'items' | 'container'>,
>(
  config: VirtualListConfig,
  base: B,
): B & {
  itemSize: VirtualItemSize<T>;
  overscan: number;
  direction: VirtualListDirection;
} {
  const itemSize: VirtualItemSize<T> = config.dynamicHeights
    ? () => config.itemHeight
    : config.itemHeight;
  return {
    ...base,
    itemSize,
    overscan: config.buffer,
    direction: config.direction,
  };
}

export interface VirtualRange {
  start: number;
  end: number;
  offsetY: number;
  totalHeight: number;
}

export interface VirtualListController {
  /**
   * #116 cleanup protocol: controller قابل‌صدازدن است (امضای `Cleanup`) —
   * فراخوانی آن معادل `dispose()` عمل می‌کند (idempotent).
   */
  (): void;
  /** اسکرول به آیتم با index مشخص */
  scrollToIndex(index: number): void;
  /** بازسازی محاسبات offset (برای dynamic heights) */
  rebuild(): void;
  /** دریافت محدوده visible فعلی */
  getRange(): VirtualRange;
  /** #116: آزادسازی کامل (idempotent). */
  dispose(): void;
}
