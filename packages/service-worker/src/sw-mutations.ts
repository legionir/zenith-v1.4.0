// packages/service-worker/src/sw-mutations.ts
//
// صف mutations (handle/enqueue) — استخراج مکانیکی از sw.ts،
// بدون تغییر رفتار (#40).

import { logger } from '@zenith/logger';
import { addToQueue } from './sw-db';
import { _config, _queue } from './sw-state';
import type { QueuedMutation } from './sw-types';


/**
 * FEATURE (v0.4.0): هندل کردن mutation — fetch، در صورت شکست صف کن.
 *
 * اگر fetch به خطا خورد (offline)، request را در background sync queue قرار
 * می‌دهیم و یک 503 برمی‌گردانیم تا client بداند mutation بعداً retry می‌شود.
 */
export async function handleMutation(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (!response.ok && response.status >= 500) {
      // خطای سرور — صف کن برای retry.
      await enqueueMutation(request);
    }
    return response;
  } catch (err) {
    // خطای شبکه — صف کن برای retry.
    await enqueueMutation(request);
    const cfg = _config!;
    return new Response(
      JSON.stringify({
        error: 'Offline — mutation queued for background sync.',
        queueTag: cfg.backgroundSyncQueueName,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

/**
 * FEATURE (v0.4.0): اضافه کردن یک mutation به صف background sync.
 *
 * بدنه‌ی request را به‌صورت متن ذخیره می‌کنیم (نمی‌توان Request زنده را serialize کرد).
 * سپس یک sync registration با مرورگر انجام می‌دهیم تا وقتی آنلاین شد، sync event fire شود.
 */
async function enqueueMutation(request: Request): Promise<void> {
  let bodyText: string | undefined;
  try {
    if (request.body) {
      bodyText = await request.clone().text();
    }
  } catch (err) {
    bodyText = undefined;
  }

  const headers: Record<string, string> = {};
  try {
    request.headers.forEach((value: string, key: string) => {
      headers[key] = value;
    });
  } catch (err) {
    // ignore header extraction errors
  }

  const mutation: QueuedMutation = {
    url: request.url,
    method: request.method,
    headers,
    body: bodyText,
    timestamp: Date.now(),
    retryCount: 0,
  };

  // FEATURE (v0.5.0): ذخیره‌ی ماندگار در IndexedDB به‌جای آرایه‌ی حافظه‌ای.
  // `addToQueue` کلیدِ autoIncrement را برمی‌گرداند و در `mutation.id` ست می‌کنیم.
  const id = await addToQueue(mutation);
  if (id != null) {
    mutation.id = id;
    _queue.push(mutation);
  }

  // FEATURE (v0.4.0): ثبت sync با مرورگر (اگر پشتیبانی می‌شود).
  const cfg = _config!;
  if (typeof self !== 'undefined') {
    const swSelf = self as unknown as {
      registration?: {
        sync?: { register: (tag: string) => Promise<void> };
      };
    };
    if (
      swSelf.registration &&
      swSelf.registration.sync &&
      typeof swSelf.registration.sync.register === 'function'
    ) {
      try {
        await swSelf.registration.sync.register(cfg.backgroundSyncQueueName!);
      } catch (err) {
        // اگر sync ثبت نشد، mutation هنوز در صف است و در sync بعدی تلاش می‌شود.
        logger.warn(
          `[Zenith SW] sync.register failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
