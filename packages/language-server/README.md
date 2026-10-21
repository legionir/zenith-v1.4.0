# @zenith/language-server

سرور زبان LSP 3.17 برای فریم‌ورک Zenith (ایشوی #160؛ پیش‌نیاز #111).

تحلیل دایرکتیوها/سیگنال‌ها، diagnostics با کدهای `ZEN-501` و `ZEN-DEPR-xxx`،
completion، hover، go-to-definition/references/rename برای `$signal`ها،
formatting امن، semantic tokens، folding، document links (`zen-link`) و
code actionهای quick-fix — روی حافظه (تست و کلاینت نازک) یا روی stdio با
framing استاندارد `Content-Length`. سرور هرگز کرش نمی‌کند: هر ورودی بدشکل
به خطای JSON-RPC تبدیل می‌شود.

نام‌های شناخته‌شده از `@zenith/compiler` می‌آیند (`COMPILABLE_DIRECTIVES`،
`RUNTIME_DIRECTIVES`، `CORE_DIRECTIVES`) به‌علاوهٔ رجیستری seed
(`docs/meta/zenith.meta.seed.json`)؛ متن hover همان prose سید است. مهاجرت
کامل binder/گرامر همهٔ directiveهای legacy با #120 است.

## API

- `analyzeZenithDocument(text)`: استخراج دایرکتیوها و سیگنال‌ها با موقعیت دقیق خط/ستون (سازگار با نسخهٔ قبلی).
- `computeDiagnostics(text, uri?, { strict? })`: دایرکتیو ناشناس (`ZEN-501`؛ در حالت strict خطا) و شناسه‌های deprecated در expressionها (کد `ZEN-DEPR-xxx` خودشان).
- `completeAt(text, offset)` / `completeDirectives(prefix)` / `completeSignals(text, prefix)`: تکمیل بر اساس موقعیت کرسر (نام attribute ⇒ دایرکتیو؛ مقدار ⇒ سیگنال‌ها).
- `hoverAt(text, offset)`: مستندات دایرکتیو (kind، شرح، syntax، لینک) یا شمارش ارجاع‌های `$signal`.
- `findSignalDefinition` / `findSignalReferences` / `findSignalReferencesInDocuments` / `renameSignal`: تعریف = اولین ارجاع؛ rename خالص و اعتبارسنجی‌شده.
- `documentSymbols` / `foldingRanges` / `documentLinks` / `semanticTokensFor` (+ `decodeSemanticTokens`).
- `formatDocument(text)`: فقط trim انتهای خط + newline پایانی؛ idempotent.
- `codeActionsFor(text, uri, diagnostics)`: جایگزینی با نزدیک‌ترین نام، حذف attribute، جایگزینی شناسهٔ deprecated.
- `createZenithLanguageServer({ strict?, maxFileSizeKb?, onDiagnostics?, onLog? })`: دیسپچر کامل LSP (`handleMessage` + متدهای مستقیم + `dispose`).
- `attachStdioTransport(server, stdin, stdout)` + `encodeLspMessage` / `decodeLspMessages` / `createLspMessageBuffer`: ترانسپورت stdio.
- سازگاری: `createZenithServerCore()` و `createServerLifecycle()` بدون تغییر مانده‌اند.

```ts
import { analyzeZenithDocument, computeDiagnostics } from '@zenith/language-server';

const analysis = analyzeZenithDocument('<div zen-if="$ok">Hi</div>');
const diagnostics = computeDiagnostics('<div zen-tex="x"></div>', 'file:///a.html');
console.log(analysis.directives.length, diagnostics.length);
```

```ts
import { createZenithLanguageServer } from '@zenith/language-server';

const server = createZenithLanguageServer({
  onDiagnostics: (params) => console.log(params.uri, params.diagnostics.length),
});
server.openDocument({ uri: 'file:///a.html', text: '<div zen-if="x">', version: 1 });
server.dispose();
```

## Error codes

| کد | معنا |
|---|---|
| `ZEN-501` | دایرکتیو ناشناس (همان شرط warning/error کامپایلر) |
| `ZEN-DEPR-001/005/042/043/044` | شناسهٔ deprecated در expression (فقط renameهای تک‌شناسه) |
| `ZEN-2510` | متادیتای دایرکتیو بارگذاری نشد (دفاعی؛ از مسیر عمومی unreachable) |
