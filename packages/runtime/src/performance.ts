import type { PerfMeasure, ZenPerf } from './api-types';
import { isDevMode } from './dev-mode';
/** Allocate the singleton performance monitor at the same construction point. @internal */
export function createPerformanceMonitor(): ZenPerf {
    const marks = new Map<string, number>();
    const measures: PerfMeasure[] = [];

    // Auto-enable in dev mode
    let enabled = false;
    if (typeof globalThis !== 'undefined') {
      try {
        enabled = isDevMode();
      } catch {
        // ignore
      }
    }

    return {
      get enabled(): boolean {
        return enabled;
      },
      set enabled(v: boolean) {
        enabled = v;
      },

      /**
       * ثبت یک timestamp با نام مشخص.
       * بعداً می‌توان از `measure()` برای محاسبه‌ی فاصله تا timestamp بعدی استفاده کرد.
       */
      mark(name: string): void {
        if (!enabled) return;
        marks.set(name, typeof performance !== 'undefined' ? performance.now() : Date.now());
      },

      /**
       * محاسبه‌ی مدت زمان بین آخرین timestamp با نام `name` و الآن.
       * نتیجه در history ذخیره می‌شود و با `getReport()` قابل مشاهده است.
       *
       * @returns object شامل name و duration و timestamp، یا undefined اگر markی وجود نداشته باشد.
       */
      measure(name: string): PerfMeasure | undefined {
        if (!enabled) return undefined;
        const start = marks.get(name);
        if (start === undefined) return undefined;
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const duration = end - start;
        const entry: PerfMeasure = { name, duration, timestamp: end };
        measures.push(entry);
        marks.delete(name);
        return entry;
      },

      /**
       * پاک کردن تمام marks و history اندازه‌گیری‌ها.
       */
      clear(): void {
        marks.clear();
        measures.length = 0;
      },

      /**
       * دریافت گزارش تمام اندازه‌گیری‌های انجام‌شده.
       */
      getReport(): readonly PerfMeasure[] {
        return measures;
      },
    };
}
