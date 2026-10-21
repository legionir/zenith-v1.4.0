// packages/service-worker/src/sw-lifecycle.ts
//
// چرخه‌حیات SW (لغو ثبت، kill-switch، آپدیت) — استخراج مکانیکی از index.ts،
// بدون تغییر رفتار (#40).

import { logger } from '@zenith/logger';


/** @public */
export interface UnregisterSWOptions {
  /** #96: آیا تمام کش‌های CacheStorage همزمان با لغو ثبت پاک شوند؟ (پیش‌فرض: true) */
  clearCaches?: boolean;
}

/**
 * FEATURE (v0.4.0) / #96: لغو ثبت SW و پاک‌سازی کش‌های قدیمی (kill switch سمت کلاینت).
 *
 * اگر SW فعالی ثبت شده باشد، آن را لغو ثبت می‌کند و در صورت `clearCaches !== false`
 * تمام کش‌های `caches` را نیز حذف می‌کند.
 *
 * @public
 */
export async function unregisterSW(options: UnregisterSWOptions = {}): Promise<boolean> {
  const clearCaches = options.clearCaches !== false;
  if (typeof navigator === 'undefined' || typeof navigator.serviceWorker === 'undefined') {
    return false;
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (clearCaches && typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    if (regs.length === 0) return false;
    let allOk = true;
    for (const reg of regs) {
      const ok = await reg.unregister();
      if (!ok) allOk = false;
    }
    return allOk;
  } catch (err) {
    logger.error(
      `[Zenith SW] unregisterSW failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/**
 * #96: تولید اسکریپت خودحذف اضطراری (`sw-kill.js`) برای جایگزینی با `/sw.js` روی سرور.
 * @public
 */
export function createKillSwitchScript(): string {
  return [
    '// Zenith Service Worker Emergency Kill Switch (#96)',
    "self.addEventListener('install', () => { self.skipWaiting(); });",
    "self.addEventListener('activate', (event) => {",
    '  event.waitUntil((async () => {',
    "    if (typeof caches !== 'undefined') {",
    '      const keys = await caches.keys();',
    '      await Promise.all(keys.map((k) => caches.delete(k)));',
    '    }',
    '    await self.registration.unregister();',
    '    if (self.clients && self.clients.matchAll) {',
    "      const clients = await self.clients.matchAll({ type: 'window' });",
    '      for (const client of clients) {',
    '        if (client.navigate) await client.navigate(client.url);',
    '      }',
    '    }',
    '  })());',
    '});',
  ].join('\n');
}

/**
 * FEATURE (v0.4.0): بررسی برای آپدیت SW.
 *
 * همه‌ی registrationهای فعال را می‌گیرد و `update()` را روی هرکدام صدا می‌زند.
 *
 * @returns true اگر حداقل یک registration بدون خطا update شد.
 * @public
 */
export async function updateSW(): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.serviceWorker === 'undefined') {
    return false;
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return false;
    let anyOk = false;
    for (const reg of regs) {
      try {
        await reg.update();
        anyOk = true;
      } catch (err) {
        // ignore individual registration errors
      }
    }
    return anyOk;
  } catch (err) {
    logger.error(
      `[Zenith SW] updateSW failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}
