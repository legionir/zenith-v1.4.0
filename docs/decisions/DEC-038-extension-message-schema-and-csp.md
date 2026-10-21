# DEC-038: مرز امنیتی افزونه‌ها — یک ماژول schema، «نادیده‌گرفتنِ» پیام نامعتبر، CSP غیرِ inline

- **وضعیت:** پذیرفته‌شده (موج ۹، #67)
- **اصلاحیهٔ ۲۰۲۶-۱۰-۱۹ (#67، سخت‌گیرانه‌سازی style):** `style-src` وب‌ویو از
  `${cspSource} 'unsafe-inline'` به `'nonce-…'` (همان nonce هر پنل) و
  `style-src` صفحات افزونه به `'self'` (stylesheet خارجی) ارتقا یافت؛ تصمیم
  مرزی (schema واحد + نادیده‌گرفتن) سر جایش است.
- **تاریخ:** ۲۰۲۶-۱۰-۱۶
- **مرتبط:** DEC-020 (فضای کدهای خطا)، DEC-024 (مرزهای اختیاری)، DEC-032 (پروتکل cleanup)، DEC-036 (امضای options)، #8 (CSP اولیهٔ افزونه)، #60 (threat model)، #67، #93 (پالایش PII)، #112 (خطاهای راهنما‌دار)

## زمینه

`#67` سه سطح حملهٔ متفاوت را در دو افزونهٔ مخزن می‌بست:

1. **افزونهٔ مرورگر (`tools/devtools-extension`)** سه منبع دادهٔ **غیرقابل‌اعتماد**
   دارد: پیام‌های `chrome.runtime.onMessage` (هر script صفحهٔ بازدیدشده می‌تواند
   بفرستد)، نتیجهٔ `chrome.scripting.executeScript` روی `window.__ZENITH__`، و
   `?data=<base64-JSON>` در `graph-viewer.html`. تا پیش از این، هر سه مسیر مستقیم
   در popup/viewer رندر می‌شدند: `innerHTML` با رشته‌های صفحهٔ میزبان
   (XSS ⇒ اجرای کد در context افزونه با دسترسی `activeTab`/`scripting`).
2. **پنل DevTools افزونهٔ VS Code (`tools/vscode-extension`)** با
   `enableScripts: true` یک صفحهٔ وب کامل است؛ HTML آن به‌صورت رشتهٔ inline ساخته
   می‌شد، بدون nonce، با `onclick=` داخل رشته و دو نقطهٔ `innerHTML` روی داده.
   CSP نداشت (VS Code به‌صورت پیش‌فرض `default-src` تنگ نمی‌کند).
3. **قرارداد پیام** هیچ‌جا مکتوب نبود: typeها رشته‌های جادوییِ پراکنده در چهار فایل
   بودند و «پیام ناشناخته» بی‌سروصدا باعث خطای زمان اجرا می‌شد.

سؤال طراحی: پالایش کجا بنشیند، و با ورودی نامعتبر **چه** کنیم؟

## گزینه‌ها

1. **پاک‌سازی در هر نقطهٔ مصرف (enforce-in-consumer).** رد شد: سه مصرف‌کننده
   (popup، graph-viewer، service worker) × سه منبع ⇒ ۹ مسیر پالایش موازی؛ یک
   فراموشی = hole. همچنین popup نمی‌تواند به پاک‌سازی service worker اعتماد کند
   (پیام می‌تواند از صفحهٔ میزبان مستقیم بیاید).
2. **استفاده از کتابخانهٔ بیرونی (zod/ajv) داخل افزونه.** رد شد: افزونه بدون
   bundler و بدون `node_modules` بار می‌شود (فایل‌های خام MV3)، و افزودن وابستگی
   جدید برای یک schema کوچک با محدودیت‌های CSP/عرضه توجیه ندارد.
3. **یک ماژول مشترک `message-schema.js` + «نادیده‌گرفتنِ» کامل ورودی نامعتبر
   (انتخاب‌شده).** ماژول یک اسکریپت کلاسیک است که خودش را روی
   `globalThis.ZenithDevtoolsSchema` می‌گذارد و در **چهار** بستر مصرف می‌شود:
   `<script src>` در سه صفحهٔ HTML، `self.importScripts()` در service worker، و
   `vm.runInThisContext` در تست‌ها (ریشهٔ مخزن `"type":"module"` است و افزونه
   باید همان چیزی باشد که مرورگر می‌بیند). قرارداد: allowlist نوع، plain-object
   فقط، رد کلیدهای `__proto__`/`constructor`/`prototype` در هر عمق، سقف طول/تعداد،
   و **ورودی نامعتبر = بی‌صدا نادیده گرفته می‌شود** (نه `throw`، نه warn، نه رندر
   نیمه‌کاره) — یک پیام جعلی نباید بتواند DevTools را به خطا بیندازد (DoS) و
   نباید توجه کاربر را هم برباید.
4. **CSP فقط با `script-src 'self'` در webview VS Code.** رد شد: اسکریپت webview
   ناچار aست inline باشد (بدون build step/فایل جانبی)، پس `'self'` کافی نیست؛
   nonce لازم است و `default-src 'none'` را هم با آن می‌آوریم.

## تصمیم و دلیل

1. **یک ماژول schema، یک مفهوم:** `tools/devtools-extension/message-schema.js`
   تنها منبعِ اعتبارسنجی است و API آن (نه فایل‌های مصرف‌کننده) مرز امنیتی را
   تعریف می‌کند: `validateRuntimeMessage`, `validateNotification`,
   `isTrustedSender`, `sanitizeGraphPayload`, `sanitizeInspectionResponse`,
   `cleanText`, `escapeHtml`, `clampCount`.
2. **دو سطح اعتبارسنجی در webview:** `validateWebviewMessage` روی پیام ورودی
   (allowlist `refresh`/`connect`) + `isDevToolsHostMessage` که اسکریپت webview
   خودش هم به کار می‌برد؛ دادهٔ خروجی host فقط از `buildDevToolsData`/
   `buildStatusMessage` عبور می‌کند (سقف‌دار، `textContent`-محور).
3. **CSP غیرِ inline با nonce تازه در هر پنل:** `createNonce()` = ۱۶ بایت
   `randomBytes` ⇒ base64، `buildWebviewCsp` =
   `default-src 'none'; script-src 'nonce-…'; style-src 'nonce-…'; img-src ${webview.cspSource} data:; connect-src 'none'; base-uri 'none'; form-action 'none'`.
   `enableScripts: true` می‌ماند (پنل بدون JS بی‌فایده است) ولی هیچ
   `<script src>`، هیچ inline handler و هیچ `eval`/`new Function` وجود ندارد و
   `localResourceRoots: []` است. صفحات افزونهٔ مرورگر هم از CSP متای سخت
   (`default-src 'self'; …; object-src 'none'; base-uri 'none'; form-action 'none'`)
   به‌علاوهٔ همان CSP در `manifest.content_security_policy.extension_pages` استفاده
   می‌کنند.
4. **صفر `innerHTML` برای دادهٔ ورودی:** popup و graph-viewer کاملاً با
   `createElement`/`textContent`/`replaceChildren` رندر می‌کنند و `escapeHtml` فقط
   برای جاهایی می‌ماند که ساخت رشتهٔ HTML اجتناب‌ناپذیر است (خروجی آن هم
   `escape`‌شده است). سقف‌ها در `LIMITS` هستند تا یک صفحهٔ خرابکار نتواند popup را
   با حجم داده بکشد.
5. **تست به‌جای توضیح:** `scripts/test/devtools-message-schema.test.mjs` ماژول را
   با همان مسیر مرورگر (`vm.runInThisContext`) بار می‌کند و allowlist، کلیدهای
   ناامن، فرستندهٔ متقلب، سقف‌ها و یال‌های معلق را تست می‌کند؛
   `tools/vscode-extension/test/webview.test.ts` CSP/nonce/non-`innerHTML` را
   و `scripts/test/devtools-extension.test.mjs` ترتیب بارگذاری و متای CSP را.

## پیامدها

- **مثبت:** سطح حملهٔ «افزونهٔ افزونهٔ مرورگر» بسته شد؛ هر پیام/دادهٔ نامعتبر
  اکنون فقط نادیده گرفته می‌شود و رفتار افزونه پیش‌بینی‌پذیر است. افزودن منبع
  دادهٔ جدید = افزودن یک تابع پاک‌سازی در همان ماژول (نه پالایش در مصرف‌کننده).
  وب‌ویو VS Code دیگر با `default-src 'none'` اجرا می‌شود.
- **منفی/ریسک پذیرفته‌شده:** ماژول schema یک اسکریپت کلاسیک است (نه ESM/TS) چون
  باید بدون build در MV3 بار شود؛ درست‌بودنش با تست VM تضمین می‌شود، نه type-system.
  سقف‌های `LIMITS` یعنی دادهٔ بزرگ‌تر **دور ریخته** می‌شود (بدون بریدن/هشدار) — برای
  DevTools قابل قبول است، ولی اگر روزی export داده لازم شد باید صریحاً طراحی شود.
  سقف بودجهٔ باندل پکیج‌های مخزن تحت تأثیر نیست (فایل خارج از `dist` است).
- پالایش جزئی رکوردها (مثلاً حذف `secret` ناشناخته) لایهٔ دوم است؛ لایهٔ اول
  `redact` در `@zenith/devtools-core` (#93) باقی می‌ماند.
