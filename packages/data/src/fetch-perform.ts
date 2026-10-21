// packages/data/src/fetch-perform.ts
//
// اجرای fetch با race-guard و retry-429 دایرکتیو zen-fetch — استخراج مکانیکی
// از fetcher.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import type { Signal } from '@zenith/state';
import { resourceHttpError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { FetchState } from './fetch-helpers';


// ═══════════════════════════════════════════════════════════════════════
// Perform fetch
// ═══════════════════════════════════════════════════════════════════════

/**
 * انجام fetch و آپدیت fetchStateSignal.
 *
 * این تابع async است و نتیجه‌ی fetch را در Signal قرار می‌دهد.
 *
 * از AbortController برای لغو fetch در صورت شروع fetch جدید یا dispose استفاده
 * می‌کند. این کار از هدررفت bandwidth جلوگیری می‌کند.
 *
 * BUG-DAT-01: AbortController پس از اتمام (موفقیت یا خطا) پاک می‌شود.
 * BUG-DAT-02: HTTP 429 با Retry-After مدیریت می‌شود (حداکثر ۳ بار تلاش).
 * BUG-DAT-03: متد و بدنه درخواست قابل تنظیم است.
 *
 * @param url             URL درخواست.
 * @param signal          Signal وضعیت fetch.
 * @param fetchId         ID این fetch (برای race condition check).
 * @param getCurrentFetchId  ID آخرین fetch (برای مقایسه).
 * @param abortController AbortController برای لغو این fetch.
 * @param method          متد HTTP (GET, POST, PUT, DELETE). پیش‌فرض: GET.
 * @param body            بدنه درخواست (برای POST/PUT).
 * @param retryCount      تعداد تلاش مجدد (برای 429).
 * @returns Promise<void>.
 */
export interface PerformFetchOptions {
  url: string;
  signal: Signal<FetchState>;
  fetchId: number;
  getCurrentFetchId: () => number;
  abortController: AbortController;
  /** متد HTTP. @default 'GET' */
  method?: string;
  /** بدنهٔ درخواست (POST/PUT). @default null */
  body?: string | null;
  /** تعداد تلاش‌های مجدد انجام‌شده (برای 429). @default 0 */
  retryCount?: number;
}

// #55: امضای داخلی هم options-object است (هیچ پارامتر positional پیکربندی نمی‌ماند).
export async function performFetch(options: PerformFetchOptions): Promise<void> {
  const {
    url,
    signal,
    fetchId,
    getCurrentFetchId,
    abortController,
    method = 'GET',
    body = null,
    retryCount = 0,
  } = options;
  const MAX_RETRIES = 3;

  // فقط اگر این fetch هنوز آخرین fetch است.
  if (fetchId !== getCurrentFetchId()) return;
  signal.set({ loading: true, error: null, data: null });

  try {
    // BUG-DAT-03: پشتیبانی از متد و بدنه سفارشی
    const init: RequestInit = { signal: abortController.signal };
    if (method !== 'GET') {
      init.method = method;
      if (body !== null) {
        init.body = body;
      }
    }

    const res = await fetch(url, init);

    // BUG-DAT-02: مدیریت HTTP 429 (Too Many Requests)
    if (res.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = res.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
      logger.warn(
        `[Zenith] Rate limited. Retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
      );
      abortController.abort(); // BUG-DAT-01: پاکسازی controller قدیمی
      await new Promise((resolve) => setTimeout(resolve, delay));
      // اگر در حین تأخیر، fetch دیگری شروع شده، تلاش مجدد را لغو کن.
      if (fetchId !== getCurrentFetchId()) return;
      return performFetch({
        url,
        signal,
        fetchId,
        getCurrentFetchId,
        abortController: new AbortController(),
        method,
        body,
        retryCount: retryCount + 1,
      });
    }

    if (!res.ok) {
      throw resourceHttpError(url, res.status, res.statusText);
    }

    // تلاش برای parse کردن JSON. اگر نشد، text برمی‌گردانیم.
    let data: any;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    // اگر در حین fetch، fetch دیگری شروع شده بود، این نتیجه را دور بریز.
    if (fetchId !== getCurrentFetchId()) return;

    signal.set({ loading: false, error: null, data });
  } catch (err) {
    // اگر fetch abort شده (توسط fetch جدید یا dispose)، خطا را نمایش نده.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return; // Silent abort — این رفتار عمدی است.
    }

    // اگر در حین fetch، fetch دیگری شروع شده بود، این نتیجه را دور بریز.
    if (fetchId !== getCurrentFetchId()) return;

    // BUG-DAT-01: پاکسازی AbortController در صورت خطا (جلوگیری از انباشت)
    abortController.abort();

    const message = err instanceof Error ? err.message : String(err);
    signal.set({ loading: false, error: message, data: null });
  }
}