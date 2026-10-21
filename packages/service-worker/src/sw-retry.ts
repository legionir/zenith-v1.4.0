// packages/service-worker/src/sw-retry.ts
//
// retry با backoff — استخراج مکانیکی از sw.ts، بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import type { QueuedMutation } from './sw-types';


/**
 * FEATURE (v0.5.0): retry یک mutation از صف.
 *
 * @returns true اگر موفق بود، false اگر باز هم fail شد.
 */
async function retryMutation(mutation: QueuedMutation): Promise<boolean> {
  try {
    const response = await fetch(mutation.url, {
      method: mutation.method,
      headers: mutation.headers,
      body: mutation.body,
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}

/**
 * FEATURE (v0.5.0): retry با exponential backoff و jitter.
 *
 * به‌جای تلاشِ فوری و مکرر، بین تلاش‌ها وقفه می‌اندازیم که تصاعدی (exponential)
 * رشد می‌کند و jitter تصادفی به آن اضافه می‌شود تا از thundering herd جلوگیری شود.
 *
 * تاخیرها: 1s, 2s, 4s, 8s, ... (با cap روی 30s) + jitter تا 20%.
 *
 * @param mutation   mutation برای retry.
 * @param options    گزینه‌ها (`{ maxRetries }`) یا — قدیمی — تعداد retryها.
 * @returns true اگر حداقل یک تلاش موفق بود.
 */
/** @public */
export interface RetryWithBackoffOptions {
  /** تعداد retryهای داخلی. @default 3 */
  maxRetries?: number;
}

/** @public */
export async function retryWithBackoff(mutation: QueuedMutation, options?: RetryWithBackoffOptions): Promise<boolean>;
/** @public @deprecated #55 — امضای positional؛ از `retryWithBackoff(mutation, { maxRetries })` استفاده کنید (ZEN-DEPR-067، حذف در ۲.۰). */
export async function retryWithBackoff(mutation: QueuedMutation, maxRetries?: number): Promise<boolean>;
export async function retryWithBackoff(mutation: QueuedMutation, maxRetriesOrOptions?: number | RetryWithBackoffOptions): Promise<boolean> {
  if (typeof maxRetriesOrOptions === 'number') {
    deprecate('ZEN-DEPR-067', 'retryWithBackoff(mutation, maxRetries)', 'retryWithBackoff(mutation, { maxRetries })');
  }
  const maxRetries = typeof maxRetriesOrOptions === 'number' ? maxRetriesOrOptions : (maxRetriesOrOptions?.maxRetries ?? 3);
  const baseDelay = 1000;
  const maxDelay = 30000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ok = await retryMutation(mutation);
    if (ok) return true;
    if (attempt < maxRetries) {
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      // NON-SECURITY (#64): jitter تصادفیِ backoff فقط برای پراکندن درخواست‌ها
      // است؛ قابل‌حدس‌زدن بودنش آسیب‌پذیری ایجاد نمی‌کند و شناسه/توکن نیست.
      // eslint-disable-next-line no-restricted-syntax -- non-security backoff jitter (#64)
      const jitter = delay * 0.2 * Math.random();
      await new Promise((r) => setTimeout(r, delay + jitter));
    }
  }
  return false;
}
