// packages/logger/src/sinks.ts
//
// #143 — sinkهای رسمی SPEC §۲.۳: consoleSink / bufferSink / beaconSink.
//
// ESLint `no-console`: این فایل تنها جای src کل ورک‌اسپیس است که console
// مصرف می‌کند — و دقیقاً کارش همان است (SPEC §۲.۳ «استثنا فقط consoleSink»).
// به همین دلیل یک file-level disable با دلیل ثبت می‌شود؛ گیت
// scripts/test/no-console-ratchet.test.mjs مراقب است فایل دیگری console
// وارد src نکند.
//
// بودجه ≤ ۲KB gzip: این فایل عمداً فشرده است. transport beaconSink فقط
// `fetch` را می‌شناسد (Node ≥18.19 و همهٔ مرورگرهای هدف آن را دارند —
// DEC-027) و مسیر sendBeacon عمداً پیاده نشده؛ مصرف‌کنندهٔ خاص می‌تواند
// `transport` خودش را بدهد.
/* eslint-disable no-console -- consoleSink مرز رسمی console است (SPEC §۲.۳؛ #143) */
import type { LogEntry, LogSink } from './types';

/** ورودی → یک خط JSON (کلیدهای ترتیب‌دار؛ undefinedها حذف). SSR SPEC §۲.۳. */
export function entryJson(entry: LogEntry, requestId?: string | null): string {
  const r: Record<string, unknown> = {
    ts: entry.t,
    level: entry.level,
    scope: entry.scope,
    msg: entry.message,
  };
  if (entry.code !== undefined) r.code = entry.code;
  if (entry.suggestion) r.suggestion = entry.suggestion;
  if (entry.details) r.details = entry.details;
  if (requestId) r.requestId = requestId;
  return JSON.stringify(r);
}

export interface ConsoleSinkOptions {
  /**
   * SSR (SPEC §۲.۳): در سرور هر ورودی JSON خط‌به‌خط است و اگر این تابع
   * هویت درخواست فعلی را بدهد، `requestId` هم افزوده می‌شود. در مرورگر
   * نادیده گرفته می‌شود (خروجی متنی است).
   */
  requestId?: () => string | null;
}

/**
 * sink پیش‌فرض لاگر.
 * - مرورگر: متد هم‌نام سطح روی console (`debug/info/warn/error`) با `entry.text`.
 * - سرور (`isServer()`): یک خط JSON کامل در `console.log` با `requestId` اختیاری.
 */
export function consoleSink(opts?: ConsoleSinkOptions): LogSink {
  return (entry) =>
    typeof window === 'undefined'
      ? console.log(entryJson(entry, opts?.requestId?.()))
      : console[entry.level as 'debug' | 'info' | 'warn' | 'error'](entry.text ?? entry.message);
}

export interface BufferSinkOptions {
  /** سقف حلقوی؛ پیش‌فرض ۱۰۰. ورودی جدید وقتی پر است قدیمی‌ترین را حذف می‌کند. */
  maxEntries?: number;
}

/** sink بافر با API خواندن (`entries`/`clear`) — برای devtools (#147) و تست. */
export interface BufferSink extends LogSink {
  entries(): LogEntry[];
  clear(): void;
}

/** بافر درون‌حافظه‌ای؛ `entries()` کپی تدافعی است. */
export function bufferSink(opts?: BufferSinkOptions): BufferSink {
  const max = opts?.maxEntries ?? 100;
  const store: LogEntry[] = [];
  const sink = ((entry: LogEntry): void => {
    store.push(entry);
    while (store.length > max) store.shift();
  }) as BufferSink;
  sink.entries = () => store.slice();
  sink.clear = () => {
    store.length = 0;
  };
  return sink;
}

export interface BeaconSinkOptions {
  url: string;
  /** حداکثر ورودی در هر درخواست؛ رسیدن ⇒ flush فوری. */
  batchSize: number;
  /** حداکثر فاصلهٔ بین دو flush (ms) حتی اگر batch کامل نشده باشد. */
  flushInterval: number;
  headers?: Record<string, string>;
}

/**
 * sink شبکه‌ای دسته‌ای (ndjson). هرگز throw نمی‌کند؛ خطای transport
 * best-effort خورده می‌شود. `dispose()` (که لاگر هنگام آزادسازی sink صدا
 * می‌زند) batch باز را flush و تایمر را پاک می‌کند.
 */
export function beaconSink(opts: BeaconSinkOptions): LogSink {
  const queue: LogEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!queue.length) return;
    try {
      void fetch(opts.url, {
        method: 'POST',
        body: queue.splice(0).map((e) => entryJson(e)).join('\n') + '\n',
        headers: { 'content-type': 'application/x-ndjson; charset=utf-8', ...opts.headers },
      }).catch(() => {});
    } catch {}
  };

  const sink = (entry: LogEntry): void => {
    queue.push(entry);
    if (queue.length >= opts.batchSize) flush();
    else if (!timer && typeof setTimeout === 'function') {
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, opts.flushInterval);
      (timer as unknown as { unref?: () => void }).unref?.();
    }
  };
  sink.dispose = flush;
  return sink;
}
