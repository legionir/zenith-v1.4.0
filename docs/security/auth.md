# راهنمای امن ذخیرهٔ توکن، CSRF و چرخش Refresh Token (`@zenith/auth`)

> مربوط به Issue #62 (P0/security). پیش‌فرض `AuthConfig.tokenStorage` از v1.2.6
> مقدار `'memory'` است؛ انتخاب `localStorage`/`sessionStorage`/`cookie` برای توکن
> حساس در حالت development با کد **ZEN-404** در کنسول هشدار می‌دهد
> (`globalThis.__ZENITH_DEV__ = false` آن را خاموش می‌کند).

> وضعیت کاندیدای فعلی (۲۰۲۶-۱۰-۱۶): موتور class و functional یکپارچه و storage،
> لغو درخواست و sync بازنویسی شده‌اند؛ تست‌های قدیم/جدید در این فاز **اجرا نشده‌اند**.
> این راهنما تأیید ممیزی یا پذیرش production نیست. قرارداد و جدول مهاجرت:
> [README بستهٔ Auth](../../packages/auth/README.md).

## ۱. الگوی توصیه‌شده: کوکی HttpOnly سمت سرور + access token در حافظه

ذخیرهٔ توکن در `localStorage`/`sessionStorage` یا کوکی‌های سمت کلاینت
(که **نمی‌توانند** HttpOnly باشند — این پرچم فقط با `Set-Cookie` سمت سرور قابل
تنظیم است) در برابر XSS آسیب‌پذیر است: هر اسکریپتی که در صفحه اجرا شود — از
جمله یک توشهٔ آلوده در زنجیرهٔ وابستگی‌ها — می‌تواند کل session را بدزدد.

الگوی پیشنهادی (ترکیب بهترین‌ها):

1. **Refresh token:** فقط به‌صورت کوکی `HttpOnly; Secure; SameSite=Lax` (یا
   `Strict`) توسط سرور با `Set-Cookie` تنظیم شود. هرگز body/JSON پاسخ لاگین
   قرار نگیرد تا مرورگر آن را در HTTP-only storage نگه دارد و JS به آن دسترسی
   نداشته باشد.
2. **Access token:** کوتاه‌عمر (≤۱۵ دقیقه) و فقط در حافظه — یعنی
   `tokenStorage: 'memory'` (پیش‌فرض Zenith). برای بقا پس از refresh صفحه،
   هنگام boot یک `POST /auth/refresh` با کوکی HttpOnly بزنید و access token
   تازه بگیرید.
3. **همه‌جا `Secure`:** کوکی‌ها فقط روی HTTPS ارسال شوند.

```ts
// کلاینت — پیش‌فرض امن
const auth = createAuth({
  loginUrl: '/api/auth/login',
  refreshUrl: '/api/auth/refresh',
  refreshMode: 'cookie', // refresh token فقط در کوکی HttpOnly سمت سرور
  headers: { 'X-CSRF-Token': 'server-issued-value' },
  // tokenStorage حذف شد → 'memory'
  autoRefresh: true,
});
await auth.refresh(); // boot صریح؛ init حافظه بدون session خودکار refresh نمی‌زند
```

```http
# سرور در پاسخ login/refresh
Set-Cookie: rt=<refresh-token>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=1209600
```

> در `refreshMode: 'cookie'` درخواست refresh با body خالی و کوکی same-origin
> ارسال می‌شود؛ هیچ refresh token جاوااسکریپتی لازم نیست. حالت پیش‌فرض `'token'`
> برای سازگاری، refresh token JSON را لازم دارد. `tokenStorage: 'cookie'` راه ساختن
> کوکی HttpOnly نیست؛ فقط رکورد سمت کلاینت و قابل‌خواندن توسط اسکریپت است.

## ۲. CSRF

Zenith توکن CSRF اضافه نمی‌کند؛ دفاع به انتخاب شما و مرورگر وابسته است
(ذخیرهٔ token به‌تنهایی دفاع کامل CSRF نیست):

| حالت tokenStorage | CSRF | XSS |
| --- | --- | --- |
| `memory` (پیش‌فرض) | bearer دستی خودکار ارسال نمی‌شود؛ cookieهای همراه همچنان دفاع CSRF می‌خواهند | در برابر اسکریپت همان صفحه امن نیست |
| `localStorage`/`sessionStorage` | bearer دستی؛ اگر سرور cookie هم می‌پذیرد Origin/CSRF لازم است | **آسیب‌پذیر** |
| `cookie` سمت کلاینت | SameSite کمک می‌کند؛ دفاع کامل یا مجوز حذف Origin/CSRF نیست | **آسیب‌پذیر** (بدون HttpOnly) |
| کوکی HttpOnly سمت سرور | SameSite + بررسی Origin/CSRF سرور | خواندن cookie مسدود؛ XSS هنوز می‌تواند درخواست مجاز بفرستد |

الگوهای پیشنهادی:

- **Double-submit cookie:** سرور کوکی غیرحساس `csrf=<random>`
  (Non-HttpOnly، `Secure`، `SameSite=Lax`) تنظیم می‌کند؛ کلاینت همان مقدار را
  در هدر `X-CSRF-Token` می‌گذارد و سرور برابری کوکی/هدر را الزامی می‌کند.
  با `headers: { ... }` در `AuthConfig` یا `authHeaders()` قابل ارسال است.
- **Synchronizer token:** توکن در session سرور + فیلد مخفی فرم لاگین.
- در هر صورت در مسیرهای تغییردهندهٔ وضعیت، `Origin`/`Referer` را در سرور
  allow-list کنید. `SameSite` تنها لایهٔ مرورگری است، نه کل راه‌حل.

## ۳. `credentials: 'include'` و `withCredentials`

- هر دو API روی موتور واحد با `credentials: 'same-origin'` کار می‌کنند؛ endpoint
  مرورگری باید HTTP(S)، هم-origin و بدون userinfo باشد. cross-origin پیش از شبکه رد
  می‌شود؛ برای آن proxy هم-origin با بازبینی سیاست امنیتی لازم است. fallback متد
  `secureLogout` همچنان `include + keepalive` دارد، ولی endpoint خارجی را مجاز نمی‌کند.
- Auth دیگر از interceptorهای سراسری `@zenith/http` استفاده نمی‌کند؛ هدر CSRF و
  هدرهای برنامه را صریحاً در `AuthConfig.headers` تنظیم کنید.
- در `@zenith/http` گزینه‌ها مستقیم به `fetch` پاس می‌شوند
  (`HttpRequestOptions extends RequestInit`)، پس:

```ts
await http.get('/api/data', { credentials: 'include' });
// معادل XHR: xhr.withCredentials = true
```

  سناریوهای این رفتار در `packages/auth/test/auth-security.test.ts` و
  `canonical-engine.test.ts` نوشته شده‌اند؛ نتیجهٔ dirty tree فعلی هنوز نداریم.

## ۴. چرخش (Rotation) Refresh Token و تشخیص Reuse

- سرور باید در هر `POST /auth/refresh` جفت (access, refresh) تازه صادر کند
  (one-time-use refresh tokens). `refreshUrl` Zenith پاسخ را می‌خواند و
  `tokenField`/`refreshTokenField` قابل تنظیم‌اند.
- **Race guard:** `Auth.refresh()` با `_refreshPromise` تنها **یک** درخواست هم‌زمان
  می‌فرستد (در یک instance؛ نه قفل میان تب‌ها). سناریوهای
  `auth-security.test.ts` و `canonical-engine.test.ts` در کاندیدای فعلی اجرا نشده‌اند.
- **Reuse detection (سرور):** اگر refresh tokenِ مصرف‌شده دوباره ارسال شد،
  سرور کل family/session را باطل (revoke) کند و ۴۰۱ برگرداند. سمت کلاینت،
  Zenith در ۴۰۱/۴۰۳ رویداد `token-expired` را emit و `logout()` می‌کند؛
  خطاهای ۵xx/۴۲۹/شبکه موقتند و logout نمی‌کنند (auto-refresh در ۳۰ ثانیه retry می‌کند).
- برای تشخیص reuse در کلاینت: رویداد `token-expired` را به «جلسه باطل شد؛
  احراز هویت مجدد» نگاشت کنید، نه «دوباره تلاش کن».

### همگام‌سازی و teardown

- cross-tab اختیاری فقط پیام invalidation بدون توکن/کاربر/OTP می‌فرستد؛ refresh
  مشترک فقط برای رکورد persistent/remembered قابل adoption است، با validation سرور.
- scope/channel متفاوت برای sessionهای مستقل تنظیم کنید. `sessionStorage` بین تب‌ها
  مشترک نیست. قفل rotation میان تب‌ها و anti-replay سمت سرور همچنان لازم است.
- logout محلی قبل از شبکه state و storage را پاک و درخواست‌های قبلی را abort می‌کند؛
  generation مانع اثر پاسخ دیررسِ نادیده‌گیرندهٔ abort است. dispose فقط حافظه و
  resourceها را آزاد می‌کند؛ جای logout/revocation سرور نیست.
- `verifyMfa` فقط adapter endpoint است، نه پروتکل کامل challenge/recovery/anti-replay.

## ۵. چک‌لیست انتشار

- [ ] `tokenStorage` پیش‌فرض (`memory`) یا کوکی HttpOnly سمت سرور.
- [ ] `Secure` + `SameSite` روی همهٔ کوکی‌ها؛ `Path` محدود به endpoint.
- [ ] CORS: بدون wildcard وقتی `credentials: 'include'` استفاده می‌کنید.
- [ ] Origin/Referer check + (double-submit یا synchronizer) روی مسیرهای mutation.
- [ ] Rotation one-time-use + revoke-family در سرور؛ TTL access کوتاه.
- [ ] هشدار ZEN-404 در dev CI لاگ‌ها بازبینی شود (انتخاب storage پرخطر).
- [ ] `__ZENITH_DEV__ = false` در بیلد production.
