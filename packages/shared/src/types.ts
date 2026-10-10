// packages/shared/src/types.ts
//
// #141 — نوع‌های مشترک L0 (SPEC §۲.۱). صفر runtime، صفر اثر جانبی.
//
// Readable/MaybeReactive عمداً **ساختاری** تعریف شده‌اند تا چرخهٔ
// `shared ↔ state` ساخته نشود (DEC-021). برند تشخیص runtime در `state` با
// `Symbol.for('zenith.readable')` است (DEC-009/#187)؛ در سطح نوع، هر ظرف
// دارای `get(): T` یک `Readable` است و `Signal`/`Computed` همان را برآورده
// می‌کنند (تست: test/types.test-d.ts با expectTypeOf).

/** قرارداد آزادسازی (SPEC §۰.۱): هر `createX` یک `X & Disposable` برمی‌گرداند. */
export interface Disposable {
  /** آزادسازی؛ باید idempotent باشد. */
  dispose(): void;
}

/** تابع پاکسازی؛ خروجی هر `registerX`/`onX`/`bindX` (SPEC §۰.۱). */
export type Cleanup = () => void;

/** هر ظرف واکنش‌گرای قابل‌خواندن حداقل یک `get()` دارد (ساختاری، DEC-021). */
export interface Readable<T = unknown> {
  get(): T;
}

/** مقدار یا ظرف قابل‌خواندن. `state` این را با نام `MaybeSignal` re-export می‌کند. */
export type MaybeReactive<T> = T | Readable<T>;

/**
 * فلگ‌های سراسری `__ZENITH_*` (SPEC §۲.۱). این interface منبع نام‌هاست؛
 * مصرف‌کننده می‌تواند با declaration merging کلید خودش را اضافه کند.
 */
export interface ZenithGlobals {
  /** per-#47/DEC-019: `false` یعنی هشدارهای dev (ZEN-DEPR) خاموش شوند. */
  __ZENITH_DEV__?: boolean;
  __ZENITH_DEVTOOLS__?: boolean;
  __ZENITH_STATE__?: Record<string, unknown>;
  __ZENITH_CONTEXT__?: Record<string, unknown>;
  __ZENITH_ACTIONS__?: Record<string, unknown>;
  __ZENITH_ROUTE__?: Record<string, unknown>;
  __ZENITH_RELOAD__?: boolean;
  __ZENITH__?: Record<string, unknown>;
}

// declare global: همان کلیدها روی globalThis (declaration merging با
// `(globalThis as any).__ZENITH_DEV__` در errors/runtime سازگار است؛ این
// رجیستری type-only است و هیچ کد اجرا نمی‌شود).
declare global {
  var __ZENITH_DEV__: boolean | undefined;
  var __ZENITH_DEVTOOLS__: boolean | undefined;
  var __ZENITH_STATE__: Record<string, unknown> | undefined;
  var __ZENITH_CONTEXT__: Record<string, unknown> | undefined;
  var __ZENITH_ACTIONS__: Record<string, unknown> | undefined;
  var __ZENITH_ROUTE__: Record<string, unknown> | undefined;
  var __ZENITH_RELOAD__: boolean | undefined;
  var __ZENITH__: Record<string, unknown> | undefined;
}
