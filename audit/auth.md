# گزارش حسابرسی پکیج `auth`
**نسخه:** v1.3.0 | **بسته:** `@zenith/auth`

---

## ۱. خلاصه پکیج

پکیج `auth` سیستم احراز هویت فریم‌ورک Zenith را پیاده‌سازی می‌کند. کلاس `Auth` مدیریت لاگین، لاگوت، refresh توکن، دریافت اطلاعات کاربر، و زمان‌بندی خودکار refresh را بر عهده دارد. از سه روش ذخیره‌سازی توکن (localStorage/cookie/memory) پشتیبانی می‌کند و دارای محافظت race condition با `_refreshPromise` است.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/auth.ts` | ~۳۰۰ | کلاس `Auth` – مدیریت کامل چرخه احراز هویت |
| `src/index.ts` | ~۱۰ | re-export |

---

## ۳. باگ‌ها و مشکلات

### BUG-AUT-01: `_scheduleRefresh` ممکن است پس از `destroy` همچنان fire کند
- **شدت:** بالا
- **محل:** `src/auth.ts` – `_scheduleRefresh`
- **شرح:** اگر `destroy()` صدا زده شود در حالی که یک `setTimeout` برای refresh برنامه‌ریزی شده است، آن تایمر همچنان اجرا می‌شود و چون `_destroyed=true` است، سعی در refresh توکن از بین رفته می‌کند.
- **نحوه رفع:** ذخیره شناسه تایمر و پاکسازی در `destroy`:

```typescript
export class Auth {
  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;

  private _scheduleRefresh(expiresIn: number): void {
    if (this._destroyed) return;
    this._clearRefreshTimer();
    const refreshTime = Math.max(0, expiresIn - 60000); // 1 minute before expiry
    this._refreshTimer = setTimeout(() => {
      if (!this._destroyed) {
        this.refresh();
      }
    }, refreshTime);
  }

  destroy(): void {
    this._destroyed = true;
    this._clearRefreshTimer();
    this._refreshPromise = null;
    this._userSignal.set(null);
    this._tokenSignal.set(null);
  }

  private _clearRefreshTimer(): void {
    if (this._refreshTimer !== null) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  }
}
```

### BUG-AUT-02: `_refreshPromise` race guard (BUG-12) در خطا بازنشانی نمی‌شود
- **شدت:** متوسط
- **محل:** `src/auth.ts` – BUG-12 fix
- **شرح:** BUG-12 با `_refreshPromise` از race condition جلوگیری کرده است. اما اگر refresh با خطا مواجه شود، `_refreshPromise` باید null شود تا درخواست بعدی بتواند دوباره تلاش کند.
- **نحوه رفع:**

```typescript
async refresh(): Promise<boolean> {
  if (this._refreshPromise) {
    return this._refreshPromise;
  }

  this._refreshPromise = this._doRefresh().finally(() => {
    this._refreshPromise = null;
  });

  return this._refreshPromise;
}

private async _doRefresh(): Promise<boolean> {
  try {
    const response = await fetch(this._config.refreshUrl, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      this.logout();
      return false;
    }
    const data = await response.json();
    this._setTokens(data);
    return true;
  } catch (err) {
    this.logout();
    return false;
  }
}
```

### BUG-AUT-03: `sendBeacon` در SEC-A9 ممکن است در برخی مرورگرها پشتیبانی نشود
- **شدت:** کم
- **محل:** `src/auth.ts` – SEC-A9 fix
- **شرح:** SEC-A9 از `navigator.sendBeacon` برای logout مطمئن استفاده می‌کند اما `sendBeacon` در همه مرورگرها (مخصوصاً نسخه‌های قدیمی) پشتیبانی نمی‌شود.
- **نحوه رفع:** fallback به fetch معمولی:

```typescript
async secureLogout(): Promise<void> {
  const url = this._config.logoutUrl;
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      // Fallback: استفاده از fetch با keepalive
      await fetch(url, {
        method: 'POST',
        keepalive: true,
        credentials: 'include',
      });
    }
  } catch {
    // Silent fail - مهم نیست logout success شود
  }
  // پاکسازی محلی در هر صورت
  this._clearLocalState();
}
```

### BUG-AUT-04: `fetchUser` در constructor صدا زده نمی‌شود
- **شدت:** کم
- **محل:** `src/auth.ts`
- **شرح:** اگر کاربر توکن معتبری در localStorage داشته باشد، `fetchUser` در زمان ساخت Auth صدا زده نمی‌شود. اطلاعات کاربر تا اولین فراخوانی دستی `fetchUser` خالی می‌ماند.
- **نحوه رفع:** فراخوانی خودکار `fetchUser` در constructor اگر توکن وجود دارد:

```typescript
constructor(config: AuthConfig) {
  // ...
  if (this._tokenSignal.get()) {
    this.fetchUser().catch(() => {
      // اگر fetchUser ناموفق بود، logout کن
      this.logout();
    });
  }
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-AUT-01: افزودن multi-factor authentication support
- **دلیل:** امنیت بیشتر برای برنامه‌های حساس.
- **پیاده‌سازی:**

```typescript
interface MfaConfig {
  enabled: boolean;
  factorType: 'totp' | 'sms' | 'email';
  challengeUrl: string;
}

export class Auth {
  private _mfaConfig?: MfaConfig;
  private _mfaChallenge?: string;

  async loginWithMfa(credentials: Credentials): Promise<LoginResult> {
    const result = await this._login(credentials);
    if (result.requiresMfa) {
      this._mfaChallenge = result.challenge;
      return { requiresMfa: true, challenge: result.challenge };
    }
    return result;
  }

  async verifyMfa(code: string): Promise<boolean> {
    const result = await fetch(this._mfaConfig!.challengeUrl, {
      method: 'POST',
      body: JSON.stringify({ challenge: this._mfaChallenge, code }),
    });
    // ...
  }
}
```

### IMP-AUT-02: افزودن event emitter برای رویدادهای Auth
- **دلیل:** واکنش به رویدادهای login/logout/token-refresh در سراسر برنامه.
- **پیاده‌سازی:**

```typescript
type AuthEvent = 'login' | 'logout' | 'token-refresh' | 'token-expired' | 'error';

export class Auth {
  private _listeners = new Map<AuthEvent, Set<() => void>>();

  on(event: AuthEvent, callback: () => void): () => void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(callback);
    return () => this._listeners.get(event)?.delete(callback);
  }

  private _emit(event: AuthEvent): void {
    this._listeners.get(event)?.forEach(fn => fn());
  }
}
```

### IMP-AUT-03: Auth Provider React Component یا Custom Element
- **دلیل:** API اعلانی در HTML برای محافظت از مسیرها بر اساس auth state.
- **پیاده‌سازی:** دایرکتیو `zen-auth` که محتوا را بر اساس وضعیت auth نمایش دهد.

### IMP-AUT-04: Auto-refresh با بررسی online/offline
- **دلیل:** جلوگیری از درخواست refresh در حالت آفلاین.
- **پیاده‌سازی:**

```typescript
private _scheduleRefresh(expiresIn: number): void {
  if (!navigator.onLine) {
    window.addEventListener('online', () => this._scheduleRefresh(expiresIn), { once: true });
    return;
  }
  // ...
}
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **state** | `signal` برای token و user state. | ✅ درست |
| **runtime/context** | وضعیت auth در context در دسترس expressionها. | ✅ درست |
| **permission** | PermissionManager با Auth ترکیب می‌شود. | ✅ درست |
| **errors** | خطاهای احراز هویت با `reportError`. | ✅ درست |
| **stateful** | `zen-auth-view` از وضعیت auth استفاده می‌کند. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `auth` طراحی خوب و کاملی دارد. محافظت race condition (BUG-12) و ارسال امن logout (SEC-A9) از نقاط قوت هستند. مهم‌ترین کمبود: مدیریت ناقص timer در `destroy` و بازنشانی `_refreshPromise` در خطا.

**امتیاز کلی: ۷.۵/۱۰** (امن و قابل اعتماد، نیاز به بهبود lifecycle management)
