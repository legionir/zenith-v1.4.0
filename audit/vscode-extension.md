# گزارش حسابرسی @zenith/vscode-extension

> **نسخه:** 1.3.0  
> **مسیر:** packages/vscode-extension/  
> **نوع:** VSCode Extension — Language Support, Autocomplete, Validation, DevTools WebView  
> **تاریخ:** 1405-04-10 (July 2026)

---

## ۱. باگ‌ها و نواقص (Bugs)

### B-1: `lineComment` نادرست برای HTML

**فایل:** [vscode-extension/language-configuration.json](packages/vscode-extension/language-configuration.json) ~ خط ۴

```json
"comments": {
  "lineComment": "<!--",
  "blockComment": ["<!--", "-->"]
}
```

HTML **هیچ line comment ندارد**. HTML comments فقط به‌صورت block هستند (`<!-- ... -->`). تنظیم `"lineComment": "<!--"` باعث می‌شود VSCode با کلید `Ctrl+/` سعی کند `<!--` را به‌عنوان line comment اضافه کند که نتیجه‌ی نادرست (غیرمعتبر) خواهد داشت.

**سناریوی شکست:** کاربر در یک فایل `.html` زبانه‌ی HTML را انتخاب می‌کند و `Ctrl+/` را می‌زند — VSCode `<!--` را ابتدای خط قرار می‌دهد اما `-->` را در انتها نمی‌گذارد، یا comment toggle به‌درستی کار نمی‌کند.

**راه‌حل:** حذف `lineComment` یا تنظیم آن به `null`:

```json
"comments": {
  "blockComment": ["<!--", "-->"]
}
```

---

### B-2: بسیاری از directiveهای شناخته‌شده در syntax highlighting گم شده‌اند

**فایل:** [vscode-extension/syntaxes/zenith-html.tmLanguage.json](packages/vscode-extension/syntaxes/zenith-html.tmLanguage.json)

لیست directiveهایی که در tmLanguage گم شده‌اند:

| directive | وضعیت | اهمیت |
|-----------|--------|-------|
| `zen-show` | ❌ گم شده | بالا — directive رایج برای visibility |
| `zen-html-trusted` | ❌ گم شده | متوسط — escape hatch امنیتی |
| `zen-cloak` | ❌ گم شده | متوسط — FOUC prevention |
| `zen-fallback` | ❌ گم شده | کم — استفاده در error/permission fallback |
| `zen-slot` | ❌ گم شده | متوسط — slot references در component |
| `zen-css` | ❌ گم شده | کم — reactive CSS |
| `zen-suspense` | ❌ گم شده | کم — lazy loading |
| `zen-transition` | ❌ گم شده | کم — animation |

**سناریوی شکست:** کاربر از `zen-show="$isActive"` استفاده می‌کند اما رنگ آن با سایر attributeها تفاوتی ندارد و تجربه‌ی توسعه‌دهنده ضعیف می‌شود.

**راه‌حل:** افزودن patternهای گم‌شده به `zen-directives` در tmLanguage.json:

```json
{
  "name": "meta.attribute.zen-show.html",
  "match": "\\b(zen-show)\\b",
  "captures": {
    "1": { "name": "entity.other.attribute-name.zenith" }
  }
},
```

---

### B-3: تشخیص `inValue` در Completion Provider ناقص است

**فایل:** [vscode-extension/src/extension.ts](packages/vscode-extension/src/extension.ts) ~ خط ۲۹۷

```typescript
const inValue = linePrefix.lastIndexOf('"') > linePrefix.lastIndexOf(' ');
if (inValue) return undefined;
```

این logic برای تشخیص اینکه کاربر داخل یک attribute value تایپ می‌کند بسیار ساده‌انگارانه است و در لبه‌های زیر شکست می‌خورد:

1. **چندین attribute در یک خط:** `<div zen-if="x" zen-| —‌ lastIndexOf('"') = 13, lastIndexOf(' ') = 18 → درست تشخیص می‌دهد
2. **فاصله داخل value:** `<div zen-if="x > 5" zen-| — lastIndexOf('"') = 20 (اولین ") در حالی که آخرین " در x > 5 است)
3. **مقادیر با space داخل:** `<div zen-text="$user.name" class="foo bar" z| — تشخیص نادرست
4. **وجود = قبل از value:** `<div zen-if=  — lastIndexOf('"') = -1, lastIndexOf(' ') > -1 → درست می‌گوید not in value

**سناریوی شکست:** کاربر `<div zen-if="x > 5" z` تایپ می‌کند. چون `"x > 5"` حاوی space است، `lastIndexOf('"')` = شاخص اولین `"` (که قبل از space است) و `lastIndexOf(' ')` = شاخص بعد از `>` که بزرگتر است → `lastIndexOf('"') < lastIndexOf(' ')` → `inValue = false` → autocomplete نشان داده می‌شود که درست است. اما اگر attribute value شامل space باشد (مثل `zen-validate="required, email"`)، شاخص‌ها جابه‌جا می‌شوند.

**راه‌حل:** استفاده از رویکرد مبتنی بر `vscode.Position` و `vscode.TextLine`:

```typescript
const line = document.lineAt(position).text;
const prefix = line.slice(0, position.character);
// اگر قبل از cursor یک = بود و داخل "" یا '' هستیم → inside value
const eqIdx = prefix.lastIndexOf('=');
const lastQuote = Math.max(prefix.lastIndexOf('"'), prefix.lastIndexOf("'"));
if (eqIdx > 0 && lastQuote > eqIdx) return undefined;
```

---

### B-4: اسکن هم‌راه فایل‌های companion به صورت synchronous و blocking

**فایل:** [vscode-extension/src/extension.ts](packages/vscode-extension/src/extension.ts) ~ خط ۲۰۰

```typescript
sources.push(fs.readFileSync(companion, 'utf-8'));
```

`fs.readFileSync` در حلقه‌ی `collectKnownSignals` باعث blocking event loop می‌شود. اگر فایل‌های companion بزرگ باشند (مثلاً بیش از ۱۰۰۰ خط)، extension host برای چند میلی‌ثانیه مسدود می‌شود که می‌تواند باعث UI jank شود. این تابع به ازای هر تغییر متن (کلید) صدا زده می‌شود.

**سناریوی شکست:** کاربر پروژه‌ای با companion فایل‌های بزرگ (مثلاً چند صد کیلوبایت) دارد. با هر بار تایپ در HTML، VSCode UI برای لحظه‌ای lag می‌کند.

**راه‌حل:** استفاده از `fs.promises.readFile` و تغییر معماری به asynchronous:

```typescript
async function collectKnownSignals(document: vscode.TextDocument): Promise<Map<string, string[]>> {
  // ...
  const content = await fs.promises.readFile(companion, 'utf-8');
  // ...
}
```

اما چون `provideCompletionItems` synchronous است، باید از cache و version checking برای asynchronous preload استفاده کرد.

---

### B-5: Cache signalها پس از تغییر فایل‌های companion منقضی نمی‌شود

**فایل:** [vscode-extension/src/extension.ts](packages/vscode-extension/src/extension.ts) ~ خط ۴۴۱

```typescript
const saveDisposable = vscode.workspace.onDidSaveTextDocument(() => {
  knownSignalsCache.clear();
  // re-scan all open editors
});
```

`knownSignalsCache` فقط در `onDidSaveTextDocument` پاک می‌شود، اما:
- اگر companion فایل (`page.ts`) در HTML ادیتوری که باز است ذخیره نشود ولی فایل `.ts` در یک editor دیگر ذخیره شود، `onDidSaveTextDocument` صدا زده می‌شود. این **درست است** چون `onDidSaveTextDocument` برای همه‌ی فایل‌ها fire می‌شود.
- اما اگر companion فایل خارج از VSCode تغییر کند (مثلاً git pull, sed, etc.) و کاربر دوباره به HTML editor برگردد، کش stale می‌ماند.

**سناریوی شکست:** کاربر companion فایل را با `sed` یا ابزار خارجی تغییر می‌دهد (مثلاً `sed -i 's/name/fullName/g' page.ts`). VSCode فایل را ذخیره نمی‌کند (تغییر خارجی را تشخیص می‌دهد) و `onDidSaveTextDocument` fire نمی‌شود. کش منقضی نشده و signal property validation با اطلاعات قدیمی کار می‌کند.

**راه‌حل:** استفاده از `vscode.workspace.onDidChangeTextDocument` برای ردیابی تغییرات در فایل‌های companion:

```typescript
// تغییر version خیلی ساده: فقط URI را چک کن
onDidChangeTextDocument((e) => {
  if (e.document.uri.fsPath.endsWith('.ts') || e.document.uri.fsPath.endsWith('.js')) {
    // فقط کش‌هایی که از این فایل استفاده می‌کنند را پاک کن
    knownSignalsCache.forEach((_, uri) => {
      if (isCompanionOf(e.document.uri.fsPath, uri)) {
        knownSignalsCache.delete(uri);
      }
    });
  }
});
```

---

### B-6: عدم پاکسازی diagnostics پس از بسته شدن document

**فایل:** [vscode-extension/src/extension.ts](packages/vscode-extension/src/extension.ts) ~ خط ۴۳۲

```typescript
diagnostics.set(document.uri, items);
```

هنگامی که یک editor بسته می‌شود، `diagnostics` برای آن URI پاک نمی‌شود و در Problems Panel باقی می‌ماند.

**سناریوی شکست:** کاربر فایل `about.html` را باز می‌کند، خطاهای زیادی می‌بیند، فایل را می‌بندد. اما خطاهای آن در Problems Panel باقی می‌مانند تا VSCode ری‌استارت شود.

**راه‌حل:** افزودن `onDidCloseTextDocument` listener:

```typescript
const closeDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
  diagnostics.delete(doc.uri);
});
```

---

### B-7: عدم پشتیبانی از attribute valueهای با apostrophe (') در regex

**فایل:** [vscode-extension/src/extension.ts](packages/vscode-extension/src/extension.ts) ~ خط ۳۹۱

```typescript
const attrRegex = /(zen-(?:text|if|for|bind(?::\w+)?|model|action(?::[\w.]+)?|fetch|html|key|resource|validate))="([^"]*)"/g;
```

این regex فقط attribute valueهای محصور در `"..."` را پشتیبانی می‌کند و `'...'` را نادیده می‌گیرد. HTML اجازه می‌دهد attributeها با هر دو نوع quotation مشخص شوند.

**سناریوی شکست:** کاربر `<div zen-if='isActive'>` می‌نویسد و diagnostic validation را دریافت نمی‌کند.

**راه‌حل:** افزودن support برای apostrophe:

```typescript
const attrRegex = /(zen-(?:text|if|for|...))="([^"]*)"|'(zen-(?:text|if|for|...))='([^']*)'/g;
```

---

### B-8: `prop:*` attribute در snippets نادیده گرفته شده

در فایل snippets، هیچ snippet برای `prop:*` attributes (مثل `prop:userName`) وجود ندارد، در حالی که این attributes در components بسیار رایج هستند و در tmLanguage پشتیبانی می‌شوند (`"match": "\\b(prop:[a-zA-Z_]+)\\b"`).

---

### B-9: Levenshtein function با حافظه‌ی زیاد و performance ضعیف

**فایل:** [vscode-extension/src/extension.ts](packages/vscode-extension/src/extension.ts) ~ خط ۵۸

```typescript
const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
```

در بدترین حالت (property nameهای بلند)، این تابع ماتریس `(m+1) × (n+1)` می‌سازد. اگر property names طولانی باشند و تعداد زیادی property وجود داشته باشد، می‌تواند performance را تحت تأثیر قرار دهد. اما با توجه به محدودیت اندازه‌ی input (property names معمولاً < 50 کاراکتر)، این عملاً مشکل جدی نیست. فقط می‌توان از فضای `O(min(m,n))` با دو آرایه به جای ماتریس استفاده کرد.

---

### B-10: DevTools WebView بدون backend واقعی

**فایل:** [vscode-extension/src/extension.ts](packages/vscode-extension/src/extension.ts) ~ خط ۶۸۸

```typescript
panel.webview.html = getDevToolsHtml();
```

WebView Panel کاملی برای DevTools وجود دارد اما:
- هیچ اتصالی به Chrome DevTools Protocol (CDP) ندارد
- دکمه‌ی Refresh فقط یک پیام متنی نمایش می‌دهد: "برای اتصال واقعی، اپ را با --remote-debugging-port=9222 اجرا کنید."
- هیچ داده‌ای از `window.__ZENITH__` دریافت نمی‌کند
- هیچ state management یا signal visualizer ندارد

این ویژگی عملاً یک **placeholder** است و نباید به‌عنوان یک قابلیت کامل در extension منتشر شود.

**سناریوی شکست:** کاربر از منوی فرمان `Zenith: Open DevTools` را انتخاب می‌کند و یک WebView خالی با دکمه‌ی غیرفعال می‌بیند. انتظار واقعی کاربر مشاهده‌ی signalها و component tree است.

---

## ۲. پیشنهادات بهبود (Improvements)

### I-1: تنظیمات بیشتر برای autocomplete

در حال حاضر autocomplete با `'z', 'e', 'n'` فعال می‌شود. کاربران حرفه‌ای که زیاد با Zenith کار می‌کنند ممکن است بخواهند trigger characters را سفارشی کنند. می‌توان تنظیم `zenith.autocompleteTriggerChars` را به configuration اضافه کرد.

---

### I-2: Color Provider برای zen-* directive values

می‌توان یک `DocumentColorProvider` اضافه کرد که مقادیر رنگی در `$variables` را تشخیص دهد. مثلاً اگر یک signal از نوع `color` مقدار `#ff0000` داشته باشد، رنگ آن در editor نمایش داده شود.

---

### I-3: Definition Provider برای action‌ها و component‌ها

می‌توان با `vscode.languages.registerDefinitionProvider` پشتیبانی از Go to Definition اضافه کرد:
- روی `zen-action="saveUser"` کلیک کنید → به تعریف action در فایل `.ts` مربوطه بروید
- روی `zen-component="app-header"` کلیک کنید → به فایل `.html` کامپوننت بروید

---

### I-4: Reference Provider برای signalها

با `vscode.languages.registerReferenceProvider` می‌توان تمام رفرنس‌های یک signal را در پروژه پیدا کرد. این ترکیب با `collectKnownSignals` می‌تواند بسیار مفید باشد.

---

### I-5: Formatting support برای قالب‌های HTML با directiveها

VSCode's built-in HTML formatter ممکن است directiveهای Zenith را نادیده بگیرد یا آن‌ها را به‌درستی format نکند. می‌توان یک Document Formatting Edit Provider نوشت که directiveها را حفظ کند و formatting مناسب انجام دهد.

---

### I-6: Completion for component names

می‌توان در autocomplete، هنگام تایپ `zen-component="..."` یا `prop:...`، نام کامپوننت‌های موجود در پروژه را پیشنهاد داد. این نیاز به اسکن دایرکتوری components در workspace دارد.

---

### I-7: Documentation Hover برای signalها

می‌توان Hover provider را توسعه داد تا برای `$variable`ها، نوع (type) و کامنت JSDoc آن‌ها را از فایل companion نمایش دهد.

```typescript
// در hover provider:
if (word.startsWith('$')) {
  const signalName = word.slice(1);
  const type = getSignalType(signalName);
  return new vscode.Hover(new vscode.MarkdownString(`\`${signalName}: ${type}\``));
}
```

---

### I-8: Code Lens برای شمارش directiveها

می‌توان Code Lens اضافه کرد که در بالای فایل HTML تعداد directiveهای استفاده‌شده را نشان دهد:

```
⚡ 12 directives, 5 signals used | Compiled: 8, Runtime: 4
```

---

### I-9: Undo/Redo-aware برای `createComponent` و `createPage` commands

زمانی که کاربر با `Create Component` یک فایل می‌سازد، اگر بعداً دستور undo بزند، VSCode فایل ساخته‌شده را پاک نمی‌کند (چون `fs.writeFileSync` خارج از VSCode's workspace API انجام می‌شود). بهتر است از `vscode.workspace.fs.writeFile` استفاده شود:

```typescript
const contentBytes = new TextEncoder().encode(content);
await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), contentBytes);
const doc = await vscode.workspace.openTextDocument(filePath);
await vscode.window.showTextDocument(doc);
```

---

### I-10: اضافه کردن test suite برای extension

در `package.json` هیچ تستی تعریف نشده. extension شامل validation logic پیچیده‌ای است (Levenshtein, object walking, expression validation) که بدون تست رها شده. می‌توان از `@vscode/test-electron` و `mocha` برای افزودن تست‌های واحد استفاده کرد.

---

## ۳. نکات یکپارچه‌سازی (Integration Notes)

### ارتباط با سایر پکیج‌ها

| پکیج | نوع وابستگی | وضعیت |
|------|------------|-------|
| `@zenith/runtime` | برای `Zen.action()` در snippets | فقط در snippets استفاده شده |
| `@zenith/state` | برای `signal()` در snippets | فقط در snippets و `zmain` pattern |
| `@zenith/compiler` | — | هیچ وابستگی مستقیمی ندارد |
| `@zenith/devtools` | WebView panel (placeholder) | مسیر `getDevToolsHtml()` در extension تعبیه شده |

### زبان‌های پشتیبانی‌شده

| شناسه | Scope |
|-------|-------|
| `html` | VSCode's built-in HTML + snippets و providers ما |
| `zenith-html` | Custom language با grammar اختصاصی |

هر دو زبان به providers اضافه شده‌اند، اما `activationEvents` فقط `onLanguage:html` را دارد (نه `onLanguage:zenith-html`). اگر کاربر فایلی با شناسه‌ی `zenith-html` باز کند، extension فعال نمی‌شود.

**رفع:** اضافه کردن `onLanguage:zenith-html` به `activationEvents`:

```json
"activationEvents": [
  "onLanguage:html",
  "onLanguage:zenith-html",
  "onCommand:zenith.createComponent",
  "onCommand:zenith.createPage"
]
```

### نکات VSCode API

- **Extension با `@types/vscode ^1.80.0` کار می‌کند** — APIهای جدیدتر (مثل `DocumentDropEditProvider`, `InlineCompletionItemProvider`) در دسترس نیستند
- **ماژول CommonJS** (`"module": "commonjs"`) — مناسب برای VSCode Extension Host
- **هیچ LSP سرور اختصاصی ندارد** — همه چیز با VSCode API مستقیم انجام شده (مناسب برای extensionهای سبک)

---

## ۴. امتیاز کلی (Score)

| معیار | امتیاز | توضیح |
|-------|--------|--------|
| **صحت عملکرد** | ۷/۱۰ | syntax highlighting ناقص، lineComment اشتباه، مشکلات validation |
| **امنیت** | ۹/۱۰ | extension داخل VSCode sandbox اجرا می‌شود |
| **عملکرد** | ۷/۱۰ | `fs.readFileSync` blocking, Levenshtein با ماتریس کامل |
| **قابلیت نگهداری** | ۸/۱۰ | کد تمیز با کامنت‌های فارسی خوب |
| **مستندات** | ۸/۱۰ | README جامع، کامنت‌های درون کد خوب |
| **تکمیل ویژگی‌ها** | ۶/۱۰ | DevTools placeholder، چند directive گم‌شده در grammar |
| **تست** | ۱/۱۰ | هیچ تستی وجود ندارد |

> **امتیاز نهایی: ۶.۶/۱۰**

---

## ۵. جمع‌بندی

پکیج `@zenith/vscode-extension` یک extension با کیفیت خوب و طراحی مناسب است که تجربه‌ی توسعه‌دهنده‌ای خوبی را برای کار با فریم‌ورک Zenith فراهم می‌کند. مهم‌ترین مشکلات آن:

1. **متوسط (B-1):** `lineComment` نادرست → comment toggle خراب است
2. **متوسط (B-2):** directiveهای گم‌شده در syntax highlighting → `zen-show`, `zen-html-trusted`, `zen-cloak`, `zen-slot`
3. **متوسط (B-10):** DevTools WebView صرفاً placeholder است و عملکرد واقعی ندارد
4. **جزئی (B-4, B-6, B-7):** blocking I/O, diagnostics cleanup, apostrophe support
5. **یکپارچگی:** `onLanguage:zenith-html` در activationEvents گم شده

پیشنهاد می‌شود در اولویت بعدی:
- اصلاح B-1 (تاثیر مستقیم روی UX) و B-2 (تاثیر روی syntax highlighting)
- تکمیل DevTools WebView یا حذف آن تا زمانی که پیاده‌سازی واقعی CDP connection آماده شود
- افزودن حداقل یک تست واحد برای `validateExpression` و `checkSignalPropertyAccess`
- اصلاح `activationEvents` برای پشتیبانی از `zenith-html`
