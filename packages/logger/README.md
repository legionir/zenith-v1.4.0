# @zenith/logger — L0 structured logger

لاگر مرکزی Zenith (SPEC §۲.۳): سطوح لاگ، scopeهای فرزند، redact خودکار
کلیدهای حساس، sinkهای قابل‌جا‌به‌جا (`consoleSink`/`bufferSink`/`beaconSink`)،
هشدار یک‌باره (`warnOnce`) و `deprecate()` با کدهای رسمی `ZEN-DEPR-xxx`.
جایگاه: تنها مرز `console.*` کل ورک‌اسپیس (قاعدهٔ ESLint `no-console` برای
سایر srcها `error` است؛ مهاجرت کد قدیمی #39). **وابستگی فقط `errors` +
`shared`، صفر اثر جانبی، isomorphic، بودجه ≤ ۲KB gzip.**

> پکیج جدید موج ۲ (#143). نسخهٔ تولد `1.5.0` و ESM-only طبق DEC-026/DEC-027.

## نصب

```bash
npm install @zenith/logger
```

## API

| export | امضا | توضیح |
| --- | --- | --- |
| `createLogger` | `(opts?: LoggerOptions) => Logger & Disposable` | نمونهٔ مستقل با sink/سطح خودش |
| `logger` | `Logger & Disposable` | نمونهٔ پیش‌فرض، scope `zen` |
| `Logger` | `debug/info/warn/error(msgOrError, details?)`, `child(scope)`, `isEnabled(level)`, `addSink(sink) → Cleanup`, `warnOnce(key, msg)` | رابط عمومی |
| `setLogLevel` | `(level: LogLevel) => void` | سطح لاگر پیش‌فرض |
| `addSink` | `(sink: LogSink) => Cleanup` | sink به لاگر پیش‌فرض |
| `consoleSink` | `(opts?: { requestId? }) => LogSink` | مرورگر: متن/سرور: JSON خطی با requestId |
| `bufferSink` | `(opts?: { maxEntries }) => LogSink & { entries(); clear() }` | پیش‌فرض ۱۰۰، حلقوی — devtools (#147)/تست |
| `beaconSink` | `(opts: { url; batchSize; flushInterval; headers? }) => LogSink` | دسته‌ای ndjson با fetch؛ best-effort |
| `warnOnce` | `(key, msg, opts?) => void` | یک‌بار به‌ازای هر key (سراسری) |
| `deprecate` | `(oldName, newName, since, opts?) => void` | `ZEN-DEPR-xxx` یک‌بار (رجیستری errors/#47) |

گزینه‌های `createLogger`: `scope` (`'zen'`)، `level` (dev `debug` / prod
`warn` — فلگ `__ZENITH_DEV__ === false`)، `sinks` (`[consoleSink()]`)،
`redact` (`['token','password','authorization','secret','cookie']`؛ جایگزین
پیش‌فرض می‌شود نه ادغام)، `format` (`[zen:scope] CODE: message`)، `clock`.

## مثال

```ts
import { createLogger, bufferSink, beaconSink } from '@zenith/logger';

const log = createLogger({
  scope: 'myapp',
  sinks: [bufferSink({ maxEntries: 50 }), beaconSink({ url: '/ingest', batchSize: 20, flushInterval: 5000 })],
});

log.child('db').warn('query slow', { ms: 42 });        // [myapp:db] query slow
log.error(err /* ZenithError */);                      // [myapp] ZEN-xxx: پیام + 💡 پیشنهاد
log.dispose();                                         // sinkها flush/آزاد (قرارداد §۰.۱)
```

## رفتارهای تضمین‌شده با تست

- `level: 'silent'` ⇒ هیچ خروجی از هیچ sinkی (acceptance #143).
- `redact` در `details` عمق‌به‌عمق (آرایه/آبجکت تودرتو، حساس‌به‌case نیست)؛
  چرخه ⇒ `'[Circular]'` و هیچ‌گاه throw نمی‌کند.
- sink خراب: حذف می‌شود، **یک‌بار** `ZEN-1091` از sinkهای سالم گزارش می‌شود،
  برنامه نمی‌شکند و حلقهٔ لاگ ساخته نمی‌شود (reject promise هم همان مسیر).
- `deprecate()` دو فراخوانی ⇒ یک هشدار؛ `__ZENITH_DEV__ === false` ⇒ خاموش.
- `logger.error(zenithError)` کد، پیام و suggestion را چاپ می‌کند؛ اگر
  `globalThis.reportError` (نصب error-boundary) باشد، همان خطا به مسیر
  گزارش خطا هم می‌رود — بدون import از error-boundary (لایهٔ L0، DEC-021).

## SSR

sinkها per-app: در `renderToString` برای هر درخواست لاگر جدید با
`consoleSink({ requestId })` بسازید تا خروجی JSON خط‌به‌خط با `requestId`
همان درخواست تولید شود (سطح `warn` با `__ZENITH_DEV__ = false`).

## توسعه

```bash
npm run build -w @zenith/logger # esbuild + tsc → dist/ (ESM-only)
npx vitest run packages/logger  # unit + env + layering + size
node scripts/test/no-console-ratchet.test.mjs # دروازهٔ ratchet (بخش از npm test)
```

## طرح‌های تصمیم مرتبط

- DEC-026/DEC-027 — نسخهٔ `1.5.0`، ESM-only، engines ≥ 18.19
- DEC-020/#171 — `ZEN-1091` از catalog رزورشده (createReservedError)
- DEC-019/#47 — رجیستری `ZEN-DEPR-xxx` در errors (این پکیج مصرفش می‌کند)
- DEC-021/#141 — الگوی لایه: بدون یال به پکیج بالاتر (duck روی reportError)
- DEC-003 — `no-console`؛ این issue (SPEC §۲.۳) آن را به `'error'` با
  ratchet ۶۲ فایلِ بدهی ارتقا داد؛ مهاجرت کامل در #39.
