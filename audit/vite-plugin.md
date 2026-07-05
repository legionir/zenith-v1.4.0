# گزارش حسابرسی @zenith/vite-plugin

> **نسخه:** 1.3.0  
> **مسیر:** packages/vite-plugin/  
> **نوع:** Vite Plugin — HMR + DevTools Auto-inject + Compile-time Transformation  
> **تاریخ:** 1405-04-10 (July 2026)

---

## ۱. باگ‌ها و نواقص (Bugs)

### B-1: تشخیص `isBuild` با روش ناپایدار `hasOwnProperty`

**فایل:** [vite-plugin/src/index.ts](packages/vite-plugin/src/index.ts) ~ خط ۵۶

```typescript
const isBuild = ctx.hasOwnProperty('bundle') || !ctx.server;
```

`ctx.hasOwnProperty('bundle')` به Vite's internal API وابسته است و در هیچ‌کدام از نسخه‌های Vite به‌عنوان API عمومی مستند نشده. در Vite 6، ساختار `ctx` در `transformIndexHtml` تغییر کرده و ممکن است `bundle` همیشه موجود باشد یا نباشد. همچنین در Dev Mode با `optimizeDeps` فعال، `ctx.server` ممکن است null باشد و `!ctx.server` نادرست false برگرداند.

**سناریوی شکست:** کاربر در Dev Mode با ساختی که به‌اشتباه به‌عنوان Build شناسایی می‌شود، compile-time transformation اجرا می‌شود و DevTools تزریق نمی‌شود.

**راه‌حل:** استفاده از `configResolved` hook برای ذخیره‌ی `isProduction` یا استفاده از متد `resolvedConfig` که Vite به‌صورت رسمی پشتیبانی می‌کند:

```typescript
let isBuild = false;
return {
  name: 'zenith-plugin',
  configResolved(config) {
    isBuild = config.isProduction || config.command === 'build';
  },
  // ...
};
```

---

### B-2: تبدیل مستقیم `watchPatterns` به RegExp به جای Glob

**فایل:** [vite-plugin/src/index.ts](packages/vite-plugin/src/index.ts) ~ خط ۴۹

```typescript
const watchRegexes = watchPatterns && watchPatterns.length > 0
  ? watchPatterns.map(p => new RegExp(p))
  : [/\.html$/];
```

کاربر انتظار دارد `watchPatterns` از نوع **glob pattern** باشد (مثل `"**/*.html"`)، اما کد آن را مستقیماً به `new RegExp(p)` می‌دهد. Glob pattern و RegExp syntax متفاوت هستند (مثلاً `**` در glob معنی recursive دارد ولی در RegExp بی‌معنی است).

**سناریوی شکست:** کاربر glob pattern `"pages/**/*.html"` را تنظیم می‌کند و انتظار دارد همه‌ی فایل‌های HTML در pages/ و زیرشاخه‌هایش HMR شوند، اما کد `**` را به‌عنوان regex نادیده می‌گیرد و فقط مسیرهای مستقیم مطابقت دارند.

**راه‌حل:** استفاده از `micromatch` یا `picomatch` برای تبدیل glob به regex:

```typescript
import { micromatch } from 'vite'; // یا picomatch
const watchPatterns = options.watchPatterns || ['**/*.html'];
// در handleHotUpdate:
const matches = watchPatterns.some(p => micromatch.isMatch(file, p));
```

---

### B-3: `pendingModules` Map هرگز پاک نمی‌شود

**فایل:** [vite-plugin/src/index.ts](packages/vite-plugin/src/index.ts) ~ خط ۲۵۷

```typescript
// نکته: این Map در هر build پاک می‌شود (buildStart).
const pendingModules: Map<string, string> = new Map();
```

کامنت ادعا می‌کند `pendingModules` در `buildStart` پاک می‌شود، اما **هیچ `buildStart` hook پیاده‌سازی نشده است**. در SSR مکرر یا build‌های مکرر در dev server (مثل `vite build --watch`)، Map به‌طور نامحدود رشد می‌کند و باعث نشت حافظه می‌شود.

**سناریوی شکست:** در `vite build --watch` که buildها مکرراً اجرا می‌شوند، `pendingModules` از build قبلی پاک نمی‌شود و ممکن است ماژول‌های قدیمی برگردانده شوند.

**راه‌حل:** اضافه کردن `buildStart` hook:

```typescript
buildStart() {
  pendingModules.clear();
}
```

---

### B-4: `String.replace()` فقط اولین occurrence را جایگزین می‌کند

**فایل:** [vite-plugin/src/compile.ts](packages/vite-plugin/src/compile.ts) ~ خط ۲۰۰

```typescript
strippedHtml = strippedHtml.replace(d.fullMatch, compiledAttr);
```

`String.prototype.replace()` با string به‌عنوان search value، فقط **اولین** occurrence را جایگزین می‌کند. اگر دو عنصر HTML با attribute یکسان وجود داشته باشند (مثلاً دو `<div zen-if="x">`)، فقط اولین‌شان compile می‌شود و دومی untouched می‌ماند.

**سناریوی شکست:** صفحه‌ای با دو `<div zen-if="isVisible">` — اولین div به `data-zenith-compiled="zen-if"` تبدیل می‌شود ولی دومی unchanged می‌ماند و runtime walker یا آن را نادیده می‌گیرد یا پردازش تکراری انجام می‌دهد.

**راه‌حل ۱:** استفاده از regex با global flag:

```typescript
const escaped = d.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(escaped, 'g');
strippedHtml = strippedHtml.replace(regex, compiledAttr);
```

**راه‌حل ۲:** رویکرد موقعیت‌محور با استفاده از index:

```typescript
strippedHtml = 
  strippedHtml.slice(0, d.index) + 
  compiledAttr + 
  strippedHtml.slice(d.index + d.fullMatch.length);
```

---

### B-5: `data-zenith-runtime` هیچ‌گاه روی عناصر تنظیم نمی‌شود

**فایل:** [vite-plugin/src/compile.ts](packages/vite-plugin/src/compile.ts) ~ خط ۳۴۸

```typescript
const runtimeEls = root.querySelectorAll('[data-zenith-runtime="true"]');
```

کد JS تولیدشده از `querySelectorAll('[data-zenith-runtime="true"]')` استفاده می‌کند تا عناصر runtime directive را پیدا کند، اما در `transformHtml` **هیچ‌گاه** attribute `data-zenith-runtime="true"` به عناصر اضافه نمی‌شود. در عوض، runtime directives در HTML اصلی untouched باقی می‌مانند.

**سناریوی شکست:** `querySelectorAll` هیچ عنصری پیدا نمی‌کند و runtime directives هرگز توسط runtime walker پردازش نمی‌شوند.

**راه‌حل:** در `transformHtml`، برای directiveهایی که runtime هستند، به‌جای `continue` کردن، attribute را به `data-zenith-runtime="true"` تغییر دهیم:

```typescript
if (runtimeDirectiveNames.has(d.fullMatch.trim())) {
  // تبدیل به data-zenith-runtime
  const runtimeAttr = ` data-zenith-runtime="true" data-zenith-directive="${d.name}"`;
  strippedHtml = strippedHtml.replace(d.fullMatch, runtimeAttr);
  continue;
}
```

---

### B-6: مسیر DevTools غیرقابل اطمینان در `getDevtoolsPath()`

**فایل:** [vite-plugin/src/index.ts](packages/vite-plugin/src/index.ts) ~ خط ۲۶۸

```typescript
function getDevtoolsPath(): string {
  return 'node_modules/@zenith/devtools/dist/index.js';
}

// در کد تزریقی:
import { initDevTools } from '/@fs/${getDevtoolsPath()}';
```

این مسیر سخت‌کد شده در سناریوهای زیر شکست می‌خورد:
- **pnpm**: node_modules به‌صورت flat نیست، فایل در `.pnpm/@zenith/devtools@x.x.x/node_modules/@zenith/devtools/` قرار دارد
- **Monorepo با npm/yarn workspaces**: ممکن است مسیر متفاوت باشد
- **Yarn PnP (Plug'n'Play)**: هیچ مسیر فیزیکی برای import وجود ندارد

**سناریوی شکست:** کاربر با pnpm پروژه را نصب می‌کند و DevTools تزریق می‌شوند اما import با 404 مواجه می‌شود.

**راه‌حل:** استفاده از Vite resolver API برای پیدا کردن مسیر واقعی:

```typescript
configureServer(server) {
  // ذخیره مسیر واقعی در زمان شروع
  devtoolsModulePath = server.resolver.resolvePath('@zenith/devtools') || 
    '/@fs/' + require.resolve('@zenith/devtools/dist/index.js');
}
```

---

### B-7: `handleHotUpdate` برای فایل‌های غیرمطابق undefined برمی‌گرداند

**فایل:** [vite-plugin/src/index.ts](packages/vite-plugin/src/index.ts) ~ خط ۱۵۶

وقتی `enableHtmlHMR` false است، تابع `return;` (undefined) را برمی‌گرداند. طبق Vite docs، `handleHotUpdate` اگر `undefined` برگرداند، Vite **به‌صورت پیش‌فرض** رفتار HMR خودش را ادامه می‌دهد (که معمولاً full reload است). این شاید برای فایل‌های غیر-Zenith درست باشد، اما هدف توسعه‌دهنده از تنظیم `enableHtmlHMR: false` غیرفعال کردن کامل HMR است.

**سناریوی شکست:** کاربر `enableHtmlHMR: false` تنظیم می‌کند تا HMR را غیرفعال کند، اما Vite همچنان full reload انجام می‌دهد.

**راه‌حل:**

```typescript
handleHotUpdate(ctx) {
  if (!enableHtmlHMR) return []; // [] = هیچ reloadی انجام نشود
  // ...
}
```

---

### B-8: عدم پشتیبانی از `zen-show` و `zen-cloak` در compile-time

**فایل:** [vite-plugin/src/compile.ts](packages/vite-plugin/src/compile.ts) ~ خط ۱۳۵

لیست `EXPRESSION_DIRECTIVES` شامل `zen-show` نیست. این directive نیز مانند `zen-if` نیاز به اعتبارسنجی expression دارد، ولی نادیده گرفته شده است.

**سناریوی شکست:** `zen-show="$isActive"` در compile-time validation بررسی نمی‌شود و اگر expression اشتباه باشد، فقط در runtime خطا می‌دهد.

**راه‌حل:** اضافه کردن `zen-show` و `zen-cloak` به `EXPRESSION_DIRECTIVES`.

---

### B-9: `analyzeHtml()` از `compileExpression` دوبار استفاده می‌کند

**فایل:** [vite-plugin/src/compile.ts](packages/vite-plugin/src/compile.ts) ~ خط ۳۹۸

تابع `analyzeHtml` که برای بررسی مستقل HTML (خارج از build) طراحی شده، از `compileExpression` برای validation استفاده می‌کند. اما همان regex و logic در `transformHtml` هم تکرار شده. این دوگانگی کد باعث می‌شود اگر logic expression validation تغییر کند، یکی از دو مکان به‌روز نشود.

**سناریوی شکست:** بعد از افزودن یک directive جدید به `EXPRESSION_DIRECTIVES` در `transformHtml`، `analyzeHtml` از آن بی‌خبر می‌ماند.

**راه‌حل:** استخراج یک تابع مشترک `validateDirectiveExpression(name, value)` و استفاده از آن در هر دو مکان.

---

### B-10: `compile()` از `@zenith/expressions` در compile-time با user input اجرا می‌شود

**فایل:** [vite-plugin/src/compile.ts](packages/vite-plugin/src/compile.ts) ~ خط ۱۴۲

```typescript
compileExpression(value);
```

در build time، `compileExpression` روی ورودی‌های فایل HTML کاربر اجرا می‌شود. اگر user input آلوده به HTML وارد شده باشد (حتی در build time)، ممکن است باعث crash یا رفتار غیرمنتظره در کامپایلر شود. این یک آسیب‌پذیری جدی نیست چون build-time است، اما فقدان try/catch مناسب در strict mode می‌تواند build را متوقف کند.

**وضعیت:** قبلاً try/catch وجود دارد، اما در strict mode خطا دوباره throw می‌شود که می‌تواند مطلوب باشد (زودتر خطا را بگیریم).

---

## ۲. پیشنهادات بهبود (Improvements)

### I-1: پشتیبانی از `config` hook برای تنظیمات پیشرفته

در حال حاضر، `zenithPlugin()` تمام گزینه‌ها را در زمان فراخوانی می‌پذیرد. اضافه کردن `config` hook امکان تنظیم پویا (مثل غیرفعال کردن در بعضی environments) را می‌دهد:

```typescript
config(userConfig, { command, mode }) {
  if (mode === 'test') return { ... };
}
```

---

### I-2: کش کردن `hasZenithDirectives` برای عملکرد بهتر

در `transformIndexHtml` (که برای هر فایل HTML در build صدا زده می‌شود)، تابع `hasZenithDirectives` با regex روی کل فایل اجرا می‌شود. اگر فایل بزرگ باشد و directive نداشته باشد، این اسکن بیهوده است. می‌توان با کش کردن نتیجه (یا اسکن سریع‌تر فقط خط اول) بهبود داد.

---

### I-3: اضافه کردن `buildEnd` برای cleanup

برای cleanup مناسب، `buildEnd` hook می‌تواند `pendingModules` را پاک کرده و آمار compile-time را چاپ کند:

```typescript
buildEnd(error) {
  if (error) {
    console.error('[Zenith] Build failed:', error.message);
  } else {
    console.log(`[Zenith] Compiled ${compileCount} files.`);
  }
  pendingModules.clear();
}
```

---

### I-4: افزودن sourcemap به فایل‌های .zenith.js تولیدی

در حال حاضر، فایل‌های `.zenith.js` که توسط کامپایلر تولید می‌شوند، sourcemap ندارند. این کار Debugging در DevTools را بسیار سخت می‌کند. می‌توان از Vite's `this.addWatchFile` و `this.emitFile` برای تولید sourcemap استفاده کرد.

---

### I-5: اسکن فایل‌های companion برای state detection در HMR

وقتی یک فایل HTML تغییر می‌کند، HMR trigger می‌شود. اما اگر فایل companion (مثل `page.ts` یا `page.js`) تغییر کند، HMR نمی‌شود و کاربر باید full reload کند. می‌توان `handleHotUpdate` را به‌گونه‌ای توسعه داد که companion فایل‌ها را هم رصد کند:

```typescript
handleHotUpdate(ctx) {
  const { file, server } = ctx;
  // scan for companion HTML files
  if (file.endsWith('.ts') || file.endsWith('.js')) {
    const htmlMatch = file.replace(/\.(ts|js)$/, '.html');
    if (fs.existsSync(htmlMatch)) {
      server.ws.send({ type: 'custom', event: 'zenith:html-update', data: { path: htmlMatch } });
      return [];
    }
  }
  // ...
}
```

---

### I-6: پشتیبانی از `transform` hook برای inline scripts

علاوه بر `transformIndexHtml`، پشتیبانی از `transform` hook برای inline `<script>` tags داخل HTML می‌تواند امکان compile-time transformation برای کدهای JavaScript داخل HTML را فراهم کند.

---

### I-7: اضافه کردن `strict` mode logging بهتر

در `strict` mode، اگر خطایی رخ دهد، stack trace کامل چاپ نمی‌شود و فقط `e.message` نمایش داده می‌شود. می‌توان خطا را با `console.error` کامل چاپ کرد:

```typescript
console.error(`[Zenith Compile] ❌ Failed compile: ${e.message}`);
if (compile.strict) {
  console.error(e); // full stack trace
  throw e;
}
```

---

### I-8: محدود کردن `watchPatterns` پیش‌فرض به دایرکتوری‌های مشخص

پیش‌فرض `/\.html$/` همه‌ی فایل‌های HTML پروژه را شامل می‌شود. بهتر است پیش‌فرض به دایرکتوری‌های خاص مثل `pages/` و `components/` محدود شود تا HMR ناخواسته روی فایل‌های `node_modules` یا فایل‌های build output انجام نشود:

```typescript
const watchRegexes = watchPatterns && watchPatterns.length > 0
  ? watchPatterns.map(p => globToRegex(p))
  : [/\/pages\/.*\.html$/, /\/components\/.*\.html$/];
```

---

## ۳. نکات یکپارچه‌سازی (Integration Notes)

### ارتباط با سایر پکیج‌ها

| پکیج | نوع وابستگی | نکته |
|------|------------|------|
| `@zenith/compiler` | dependency | برای compile-time template transformation |
| `@zenith/expressions` | dependency | برای اعتبارسنجی expression syntax در build time |
| `@zenith/devtools` | runtime peer | مسیر آن در `getDevtoolsPath()` سخت‌کد شده |
| `@zenith/runtime` | runtime peer | برای `walkAndBind` در کدهای `.zenith.js` تولیدی |
| `@zenith/state` | runtime peer | `effect` و `signal` در کدهای کامپایل‌شده import می‌شوند |
| `@zenith/security` | runtime peer | `sanitizeHTML` و `sanitizeHTMLTrusted` در کدهای کامپایل‌شده |
| Vite | peerDependency | پشتیبانی از v5 و v6 |

### نسخه‌ی Phase

کد در وضعیت Phase 10 (از ۱۲ فاز) قرار دارد. ویژگی‌های کامل شده:
- ✅ HMR برای HTML
- ✅ DevTools auto-inject
- ✅ Compile-time transformation (basic)
- ✅ Virtual modules برای .zenith.js
- ⬜ Sourcemap support
- ⬜ Companion file HMR
- ⬜ Advanced error recovery

---

## ۴. امتیاز کلی (Score)

| معیار | امتیاز | توضیح |
|-------|--------|--------|
| **صحت عملکرد** | ۷/۱۰ | باگ‌های جدی در replace و missing data-zenith-runtime |
| **امنیت** | ۹/۱۰ | فقط build-time، خطر امنیتی پایین |
| **عملکرد** | ۸/۱۰ | pendingModules نشت حافظه دارد |
| **قابلیت نگهداری** | ۷/۱۰ | string replace logic نیاز به بازنویسی دارد |
| **مستندات** | ۸/۱۰ | README و کامنت‌های خوب به فارسی |
| **پشتیبانی از Vite ecosystem** | ۶/۱۰ | عدم استفاده از glob pattern استاندارد |

> **امتیاز نهایی: ۷.۵/۱۰**

---

## ۵. جمع‌بندی

پکیج `@zenith/vite-plugin` یک پکیج نسبتاً بالغ با طراحی خوب و مستندات مناسب است. مهم‌ترین مشکلات آن:

1. **بحرانی (B-5):** `data-zenith-runtime` هرگز تنظیم نمی‌شود → runtime directives در build mode کار نمی‌کنند
2. **بحرانی (B-4):** `replace()` فقط اولین occurrence را جایگزین می‌کند → دوبار استفاده از یک directive در یک صفحه شکست می‌خورد
3. **متوسط (B-3):** `pendingModules` پاک نمی‌شود → نشت حافظه در build --watch
4. **متوسط (B-1, B-6):** تشخیص isBuild و مسیر DevTools ناپایدار هستند → ممکن است در بعضی محیط‌ها کار نکنند

پیشنهاد می‌شود قبل از انتشار نسخه‌ی بعدی (v1.4.0)، سه باگ بحرانی و متوسط B-4، B-5، B-3 و B-1 رفع شوند. بقیه موارد جزئی هستند و می‌توانند به آینده موکول شوند.
