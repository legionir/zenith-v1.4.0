// packages/service-worker/src/sw-listeners.ts
//
// رجیستری listenerهای SW — استخراج مکانیکی از sw.ts، بدون تغییر رفتار (#40).


/**
 * رجیستری listenerهای ثبت‌شده توسط setupSW (#6، DEC-001).
 *
 * در SW واقعی global scope با هر restart دوباره ساخته می‌شود و cleanup دستی
 * لازم نیست؛ این رجیستری برای تست (mock self) و سناریوهای register مجدد در
 * همان صفحه استفاده می‌شود.
 */
const swHandlers: Array<{ type: string; handler: EventListener }> = [];

export function addSWListener(type: string, handler: EventListener) {
  swHandlers.push({ type, handler });
  (self as any).addEventListener(type, handler);
}

/**
 * همهٔ listenerهای ثبت‌شده توسط `setupSW` را حذف می‌کند (idempotent).
 * @public
 */
export function cleanupSWListeners(): void {
  for (const h of swHandlers) {
    try {
      (self as any).removeEventListener(h.type, h.handler);
    } catch {
      /* ignore */
    }
  }
  swHandlers.length = 0;
}
