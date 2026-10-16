// packages/shared/src/media.ts
//
// #119 — `prefersReducedMotion` یک منبع در L0 (پیش‌تر دو پیاده‌سازی تقریباً
// یکسان در charts و transition بود). هنگام *فراخوانی* بررسی می‌کند، نه import.

/**
 * آیا کاربر کاهش حرکت را درخواست کرده است؟
 *
 * @param doc سند هدف (پیش‌فرض: سند جهانی) — برای تست/چند-سندی.
 * @returns `true` اگر `prefers-reduced-motion: reduce` فعال باشد؛ در SSR `false`.
 */
export function prefersReducedMotion(doc?: Document): boolean {
  try {
    const view = doc?.defaultView ?? globalThis.window;
    return (
      (view as Window | undefined)?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ===
      true
    );
  } catch {
    return false;
  }
}
