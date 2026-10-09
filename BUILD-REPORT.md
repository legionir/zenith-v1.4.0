# گزارش Build — zenith-v1.4.0

تاریخ: ۲۰۲۶-۰۷-۲۶ · Node v22.22.3 · npm 10.9.8 · TypeScript 5.9.3 · esbuild 0.28.1

---

## وضعیت نهایی

| مرحله | قبل | بعد |
|---|---|---|
| `npm ci` | ❌ lockfile نامعتبر (JSON خراب) | ✅ موفق |
| `npm run build` | ❌ ۳۰ ساخته، **۴ شکست**، ۶ هشدار | ✅ **۳۴ ساخته، ۰ شکست، ۰ خطا، ۰ هشدار** |
| `npm run typecheck` | ❌ **۱۰۱ خطا** در ۱۶ پکیج | ✅ **۰ خطا** |
| `npm test` | ❌ ۰ pass، ۱۴ fail | ⚠️ بدون تغییر (توضیح در بخش «باقی‌مانده») |

```
📊 Results: 34 built, 0 failed
🎉 All packages built successfully!
🎉 All packages type-checked successfully!
```

---

## آنچه اصلاح شد

### ۱. Syntax error در `cli/src/templates.ts`

دو تابع قالب، هر کدام با یک اشکال **معکوس** در همان بلوک کد:

- `mainTsTemplate` (خط ۱۰۱): یک backtick escape نشده بود و template literal را زودتر می‌بست.
- `pwaMainTsTemplate` (خط ۶۲۲): backtickها و `${}` **اصلاً** escape نشده بودند، پس `${actionName}` در زمان build جایگزین می‌شد به‌جای اینکه به‌عنوان placeholder در پروژهٔ تولیدشده بنشیند.

> در گزارش اولیه نوشته بودم «خط ۶۲۲ الگوی درست است». این **اشتباه بود** — بعد از رفع خط ۱۰۱ مشخص شد خطای ۶۲۲ آبشاری نبوده و مشکل مستقل خودش را داشته.

**تأیید:** CLI اجرا شد، پروژه ساخت (هر دو حالت عادی و PWA)، و `main.ts` تولیدشده با TypeScript parse شد → `parse errors: 0`، و `${actionName}` سالم ماند.

### ۲. مارکرهای merge conflict در `package-lock.json`

۷ بلوک `<<<<<<< HEAD` در HEAD کامیت شده بود. تأیید قاطع:

```
git show HEAD:package-lock.json | python3 -c "json.load(sys.stdin)"
→ JSONDecodeError: line 1036   ← دقیقاً اولین مارکر
```

`npm ci` روی آن کار نمی‌کرد. حالا معتبر است و هر ۳۵ پکیج workspace درست لینک شده‌اند.

### ۳. بلوک تکراری در `runtime/src/index.ts`

`onError`/`getErrors`/`reportError` **بایت‌به‌بایت** دو بار در آبجکت `Zen` تکرار شده بودند (خطوط ۳۱۹ و ۳۵۵). قبل از حذف با مقایسهٔ برنامه‌ای تأیید شد که یکسان‌اند، پس رفتار تغییری نکرد.

### ۴. Build script — چهار اصلاح

`platform: 'neutral'` ماژول‌های Node را نمی‌شناخت. `cli`/`ssr`/`vite-plugin` حالا با `platform: 'node'` ساخته می‌شوند. سه مشکل دیگر که این تغییر آشکارشان کرد:

- **`jsdom` داخل باندل `ssr` می‌رفت — ۳.۳MB.** یک peerDependency است و باندل‌شدنش هم حجم را منفجر می‌کرد و هم بررسی runtime خودِ کد («آیا jsdom نصب است؟») را بی‌اثر. حالا همهٔ peerDependencyها external‌اند → **۱۲KB**.
- **CLI با وجود build موفق، در runtime می‌شکست:** `Dynamic require of "node:events" is not supported` (از `commander`). با banner مربوط به `createRequire` حل شد.
- `import.meta` در خروجی CJS به `undefined` تعریف شد تا گاردهای HMR به fallback موجودشان (`pagehide`) بیفتند.

### ۵. Top-level await در `router`

`await import('node:module')` قابل باندل به CJS نبود، پس `index.cjs` **اصلاً تولید نمی‌شد** و ۶ پکیج دیگر برای `@zenith/router` به `any` سقوط می‌کردند.

`router` یک پکیج مرورگری است، پس `platform: 'node'` راه‌حلش نبود. با `process.getBuiltinModule` جایگزین شد که دسترسی sync می‌دهد بدون import ایستا — پس باندل مرورگری تمیز ماند (`grep` تأیید کرد: صفر ارجاع به `node:`).

**تأیید:** ایزولاسیون AsyncLocalStorage با دو context موازی در **هر دو** خروجی ESM و CJS تست شد → هر دو PASS.

### ۶. ۱۰۱ خطای TypeScript → صفر

باگ‌های واقعی که در این مسیر پیدا شدند:

| فایل | مشکل |
|---|---|
| `security/sanitizer.ts` | `ALLOWED_TAGS` **تعریف‌نشده** بود. `cleanNodeWithOptions` آن را به‌عنوان allowlist می‌خواند (هرچه نباشد حذف می‌شود) — یعنی مجموعهٔ خالی کل markup را نابود می‌کرد. یک allowlist محافظه‌کارانهٔ ۶۹ تگی اضافه شد. |
| `http/http.ts` | کل آبجکت options — با فیلدهای غیراستاندارد Zenith — مستقیم به `fetch()` می‌رفت. |
| `ssr/render.ts` | `EffectContext` بدون فیلد اجباری `owner` ساخته می‌شد. |
| `runtime/date-picker.ts` | `parseJalaliParts` می‌تواند `null` بدهد، بدون بررسی destructure می‌شد. |
| `runtime/track.ts` | handler کلیک، handle مربوط به `setTimeout` را از یک arrow با نوع `void` برمی‌گرداند. |
| `form/form.ts` | `move`/`swap` آرایه بدون بررسی محدوده. |

**ریشهٔ مشترک ۷ خطا:** `computed()` عملاً یک `Computed` (دارای `dispose()`) برمی‌گرداند ولی به `ReadonlySignal` تایپ شده بود و متد را از همهٔ مصرف‌کننده‌ها پنهان می‌کرد. اصلاح در `state/signal.ts` هم‌زمان ۶ خطای `crud` و ۱ خطای `store` را برد.

**تأیید امنیتی sanitizer:** allowlist با ۸ سناریوی XSS تست شد — `script`، `iframe`، `onerror` و `javascript:` همه حذف؛ متن، فرمت‌بندی، لیست و جدول حفظ. همپوشانی با `FORBIDDEN_TAGS`: صفر.

**کد مرده حذف‌شده:**
- `crud_fixed.ts` — تأیید شد نسخهٔ **قدیمی** است (فاقد رفع باگ `BUG-CRD-02`)، برخلاف چیزی که نامش القا می‌کند. هیچ‌جا import نشده بود.
- `service-worker/saveQueue` — کامنت خط ۳۲۴ توضیح می‌داد که در v1.2.7 عمداً کنار گذاشته شده چون `clear()+put()` نوشتن‌های همزمان را از دست می‌داد.

### ۷. گاردِ `tsc` در build فعال شد

مهم‌ترین تغییر ساختاری. قبلاً:

```js
if (result.status !== 0 && result.stderr) {
  // Some packages may not have declaration emit configured; that's ok
}
```

خطاهای `tsc` بی‌صدا بلعیده می‌شدند، پس build سبز هیچ تضمینی نمی‌داد. حالا با پیام کامل fail می‌کند — و بلافاصله یک خطای پنهان در `@zenith/testing` را گرفت.

### ۸. بهداشت مخزن

- `@zenith/testing` بدون `tsconfig.json` بود و **بدون هیچ `.d.ts`** منتشر می‌شد. اضافه شد.
- ۳۱ فایل `tsbuildinfo` از Git خارج و ignore شدند؛ `packages/*/out/` هم.
- `tsconfig.json` ریشه کامل شد (۳۱ → ۳۵ reference).

---

## CI/CD

### `scripts/collect-artifacts.mjs`

خروجی همهٔ پکیج‌ها را در یک مسیر جمع می‌کند:

```
artifacts/
  packages/<name>/
    dist/          index.js (ESM) · index.cjs (CJS) · index.d.ts · sourcemaps
    package.json
    README.md
  manifest.json    نسخه، حجم، entry pointها، commit/ref/run id
```

اجرای محلی:

```bash
npm run build
node scripts/collect-artifacts.mjs artifacts
```

نتیجه: **۳۴ پکیج · ۵.۸۱ MB** — هر ۳۴ تا ESM و CJS و types کامل دارند.

دو skip عمدی که در لاگ گزارش می‌شوند (نه پنهان): `devtools-extension` (بدون `package.json`) و `vscode-extension` (بدون bundle).

### `.github/workflows/ci.yml`

روی هر push، PR و اجرای دستی: `npm ci` → `typecheck` → `build` → collect → upload.
ماتریس Node **۱۸** (کف `engines`) و **۲۲** (LTS فعلی).

آرتیفکت‌ها: `zenith-bundles-node18` و `zenith-bundles-node22`، نگهداری ۳۰ روز، به‌همراه جدول حجم باندل در summary هر run. تگ `v*` علاوه بر این یک `tar.gz` به GitHub Release پیوست می‌کند (تنها job با `contents: write`).

> ⚠️ **این فایل push نشد.** توکن این سشن مجوز `workflows` ندارد:
> ```
> refusing to allow a GitHub App to create or update workflow
> `.github/workflows/ci.yml` without `workflows` permission
> ```
> فایل در workspace آماده است و YAML آن اعتبارسنجی شده. برای فعال‌سازی باید دستی commit شود، یا GitHub در Arena با دسترسی `workflows` دوباره متصل شود. مستندات کامل در `.github/CI.md`.

**اعتبارسنجی:** کل زنجیره از صفر (`rm -rf node_modules artifacts` سپس `npm ci`) اجرا شد → هر چهار مرحله exit 0.

---

## باقی‌مانده

### تست‌ها — پوشش صفر

هر ۱۴ شکست یک علت دارند: **پوشهٔ `test/` در هیچ پکیجی وجود ندارد**، ولی `package.json`‌ها به آن اشاره می‌کنند.

```bash
git ls-files | grep -c "test/"   # → 0
```

این را عمداً دست‌نخورده گذاشتم: نوشتن تست برای ۳۴ پکیج تصمیمی دربارهٔ دامنه و ابزار (vitest؟ node:test؟) است که ارزش پرسیدن دارد، و به همین دلیل تست‌ها هم در pipeline قرار نگرفتند تا از روز اول قرمز نباشد.

### آسیب‌پذیری‌های dev

```
esbuild <=0.24.2 (moderate) — از طریق vite <=6.4.2، فقط devDependency
```
اصلاح نیازمند `vite@8` است (breaking change). کد منتشرشده را متأثر نمی‌کند.

### نکتهٔ Node 18

`process.getBuiltinModule` در Node **18.19+** اضافه شده، ولی `engines` می‌گوید `>=18`. روی ۱۸.۰–۱۸.۱۸ کد crash نمی‌کند اما ایزولاسیون SSR بی‌صدا غیرفعال می‌شد — حالا هشدار صریح می‌دهد. اگر می‌خواهید سخت‌گیرانه باشد، `engines` را به `>=18.19` برسانید.

---

## بازتولید

```bash
npm ci
npm run typecheck                              # 0 errors
npm run build                                  # 34 built, 0 failed
node scripts/collect-artifacts.mjs artifacts   # 34 packages, 5.81 MB
```
