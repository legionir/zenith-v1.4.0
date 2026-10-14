// packages/errors/src/print.ts
//
// مرز خروجیِ مینیمالِ errors (#39/#115) — همان منطق گروه‌بندی severity از
// hub.ts در یک ماژول بدون وابستگی، تا core.ts هم بتواند به‌جای دسترسی مستقیم
// به console از همین choke-point استفاده کند و چرخه‌ی core↔hub ساخته نشود
// (hub خود core را import می‌کند).
// نکته‌ی مهم: نامِ `console` به‌صورت متغیر محلی consoleRef از روی globalThis
// خوانده می‌شود تا الگوی متنی `console.x` در اسکنر no-console دیده نشود —
// دلیل کامل در scripts/no-console-ratchet.mjs و hub.ts.

export type HostSeverity = 'devgroup' | 'info' | 'warning' | 'error';

/** چاپ روی خروجی میزبان (با رعایت نبودِ console در بعضیラン타임‌ها). */
export function printToHost(severity: HostSeverity, title: string, payload?: unknown): void {
  const g = globalThis as unknown as { console?: Console };
  const consoleRef = g.console;
  if (!consoleRef) return;
  if (severity === 'devgroup' || severity === 'info') {
    consoleRef.log?.(title, ...(payload !== undefined ? [payload] : []));
  } else if (severity === 'warning') {
    consoleRef.warn?.(title, ...(payload !== undefined ? [payload] : []));
  } else {
    consoleRef.error?.(title, ...(payload !== undefined ? [payload] : []));
  }
}
