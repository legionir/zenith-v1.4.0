// packages/data/src/fetch-helpers.ts
//
// تایپ وضعیت، state اولیه، اعتبارسنجی URL و context-builder دایرکتیو
// zen-fetch — استخراج مکانیکی از fetcher.ts بدون تغییر رفتار (#40،
// code-first: نوشته‌شده، اجرا نشده).

import type { Signal } from '@zenith/state';


/**
 * شکل وضعیت fetch.
 *
 * @property loading آیا درخواست در حال انجام است؟
 * @property error   پیام خطا در صورت شکست، یا `null`.
 * @property data    داده‌های دریافت‌شده در صورت موفقیت، یا `null`.
 */
export interface FetchState<T = unknown> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

/**
 * مقدار اولیه‌ی وضعیت fetch.
 */
export function initialFetchState(): FetchState {
  return { loading: true, error: null, data: null };
}
// ═══════════════════════════════════════════════════════════════════════
// URL validation (BUG-DAT-04)
// ═══════════════════════════════════════════════════════════════════════

/**
 * اعتبارسنجی اینکه یک رشته URL معتبر است یا خیر.
 *
 * از `new URL()` برای اعتبارسنجی استفاده می‌کند و origin پیش‌فرض را
 * به `window.location.origin` تنظیم می‌کند تا URLهای نسبی هم قبول شوند.
 *
 * @param urlStr رشته URL برای اعتبارسنجی.
 * @returns `true` اگر URL معتبر است.
 */
export function isValidUrl(urlStr: string): boolean {
  if (typeof urlStr !== 'string' || urlStr.length === 0) return false;
  try {
    new URL(urlStr, window.location.origin);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Context builder
// ═══════════════════════════════════════════════════════════════════════

/**
 * ساخت Context محلی برای zen-fetch.
 *
 * این Context:
 *   - تمام کلیدهای Context والد را به ارث می‌برد (با prototype chain).
 *   - یک کلید جدید اضافه می‌کند: `$<stateName>` که به fetchStateSignal اشاره می‌کند.
 *
 * نکته: getter استفاده می‌کنیم تا dependency tracking فعال شود.
 */
export function buildFetchContext(
  parentContext: Record<string, any>,
  stateName: string,
  fetchStateSignal: Signal<FetchState>,
): Record<string, any> {
  const child: Record<string, any> = Object.create(parentContext);

  Object.defineProperty(child, `$${stateName}`, {
    get: () => fetchStateSignal.get(),
    enumerable: true,
    configurable: true,
  });

  return child;
}