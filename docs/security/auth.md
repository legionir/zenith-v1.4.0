# راهنمای امن ذخیرهٔ توکن، CSRF و چرخش Refresh Token (`@zenith/auth`)

> مربوط به Issue #62 (P0/security). پیش‌فرض `AuthConfig.tokenStorage` از v1.2.6
> مقدار `'memory'` است؛ انتخاب `localStorage`/`sessionStorage`/`cookie` برای توکن
> حساس در حالت development با کد **ZEN-404** در کنسول هشدار می‌دهد
> (`globalThis.__ZENITH_DEV__ = false` آن را خاموش می‌کند).

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
  // tokenStorage حذف شد → 'memory'
  autoRefresh: true,
});
```

```http
# سرور در پاسخ login/refresh
Set-Cookie: rt=<refresh-token>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=1209600
```

> نکته: در حالت کوکی-سمت-سرور، بدنۀ پاسخ refresh فقط `access token` را برمی‌گرداند
> و refresh token در body نیست؛ Zenith در `_doRefresh` در نبود فیلد
> `refreshToken` مقدار قبلی را نگه می‌دارد (و در حالت `memory` توکنی برای نگه‌داشتن
> نیست) — پس با سرور خود را هماهنگ کنید: یا `tokenStorage: 'cookie'` را برای
> متادیتای غیرحساس به کار ببرید، یا flow حافظه‌محور را با refresh در boot بالا بیاورید.

## ۲. CSRF

Zenith توکن CSRF اضافه نمی‌کند؛ دفاع به انتخاب شما و مرورگر وابسته است
(تحلیل کامل در کامنت SEC-A13 داخل `packages/auth/src/auth.ts`):

| حالت tokenStorage | CSRF | XSS |
| --- | --- | --- |
| `memory` (پیش‌فرض) | عملاً غیرممکن (توکن خودکار ارسال نمی‌شود) | ضربه محدود به tab |
| `localStorage`/`sessionStorage` | غیرممکن (توکن هدر دستی است) | **آسیب‌پذیر** |
| `cookie` سمت کلاینت | `SameSite=Strict` بلاک می‌کند | **آسیب‌پذیر** (بدون HttpOnly) |
| کوکی HttpOnly سمت سرور | SameSite + بررسی Origin سرور | محافظت‌شده |

الگوهای پیشنهادی:

- **Double-submit cookie:** سرور کوکی غیرحساس `csrf=<random>`
  (Non-HttpOnly، `Secure`، `SameSite=Lax`) تنظیم می‌کند؛ کلاینت همان مقدار را
  در هدر `X-CSRF-Token` می‌گذارد و سرور برابری کوکی/هدر را الزامی می‌کند.
  با `headers: { ... }` در `AuthConfig` یا `authHeaders()` قابل ارسال است.
- **Synchronizer token:** توکن در session سرور + فیلد مخفی فرم لاگین.
- در هر صورت در مسیرهای تغییردهندهٔ وضعیت، `Origin`/`Referer` را در سرور
  allow-list کنید. `SameSite` تنها لایهٔ مرورگری است، نه کل راه‌حل.

## ۳. `credentials: 'include'` و `withCredentials`

- متدهای کلاس `Auth` (login/logout/refresh/fetchUser) با
  `credentials: 'same-origin'` درخواست می‌زنند: کوکی‌ها فقط با همان origin
  ارسال می‌شوند (پیش‌فرض امن). برای API روی دامنهٔ متفاوت (cross-origin) باید
  صریحاً `credentials: 'include'` لازم است؛ تنها جای Zenith که این کار را
  می‌کند `secureLogout` در fallback به fetch است (تا کوکی HttpOnly هم هنگام
  بستن تب invalidate شود). در حالت `include` سرور **نباید**
  `Access-Control-Allow-Origin: *` بفرستد؛ مقدار دقیق origin +
  `Access-Control-Allow-Credentials: true` لازم است.
- در `@zenith/http` گزینه‌ها مستقیم به `fetch` پاس می‌شوند
  (`HttpRequestOptions extends RequestInit`)، پس:

```ts
await http.get('/api/data', { credentials: 'include' });
// معادل XHR: xhr.withCredentials = true
```

  رفتار در تست‌های `packages/auth/test/auth-security.test.ts` قفل شده است
  (same-origin برای login؛ include+keepalive برای fallbackِ secureLogout).

## ۴. چرخش (Rotation) Refresh Token و تشخیص Reuse

- سرور باید در هر `POST /auth/refresh` جفت (access, refresh) تازه صادر کند
  (one-time-use refresh tokens). `refreshUrl` Zenith پاسخ را می‌خواند و
  `tokenField`/`refreshTokenField` قابل تنظیم‌اند.
- **Race guard:** `Auth.refresh()` با `_refreshPromise` تنها **یک** درخواست هم‌زمان
  می‌فرستد (چند caller ۴۰۱ هم‌زمان → یک rotation) — تست‌شده در
  `auth-security.test.ts`.
- **Reuse detection (سرور):** اگر refresh tokenِ مصرف‌شده دوباره ارسال شد،
  سرور کل family/session را باطل (revoke) کند و ۴۰۱ برگرداند. سمت کلاینت،
  Zenith در ۴۰۱/۴۰۳ رویداد `token-expired` را emit و `logout()` می‌کند؛
  خطاهای ۵xx/۴۲۹ موقتند و logout نمی‌کنند (قابل retry).
- برای تشخیص reuse در کلاینت: رویداد `token-expired` را به «جلسه باطل شد؛
  احراز هویت مجدد» نگاشت کنید، نه «دوباره تلاش کن».

## ۵. چک‌لیست انتشار

- [ ] `tokenStorage` پیش‌فرض (`memory`) یا کوکی HttpOnly سمت سرور.
- [ ] `Secure` + `SameSite` روی همهٔ کوکی‌ها؛ `Path` محدود به endpoint.
- [ ] CORS: بدون wildcard وقتی `credentials: 'include'` استفاده می‌کنید.
- [ ] Origin/Referer check + (double-submit یا synchronizer) روی مسیرهای mutation.
- [ ] Rotation one-time-use + revoke-family در سرور؛ TTL access کوتاه.
- [ ] هشدار ZEN-404 در dev CI لاگ‌ها بازبینی شود (انتخاب storage پرخطر).
- [ ] `__ZENITH_DEV__ = false` در بیلد production.
