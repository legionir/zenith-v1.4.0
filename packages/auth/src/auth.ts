// packages/auth/src/auth.ts
//
// @zenith/auth — Authentication Runtime (Phase 4).
//
// این پکیج مدیریت کامل authentication را فراهم می‌کند:
//   - login / logout / register
//   - token management (access + refresh)
//   - session persistence (localStorage / cookie)
//   - auto-refresh قبل از expiry
//   - route guards (redirect به login اگر unauthorized)
//   - user state reactive (Signal)
//
// ── سینتکس ─ـ
//
//   // main.ts
//   import { createAuth } from '@zenith/auth';
//
//   const auth = createAuth({
//     loginUrl: '/api/auth/login',
//     logoutUrl: '/api/auth/logout',
//     refreshUrl: '/api/auth/refresh',
//     meUrl: '/api/auth/me',
//     tokenStorage: 'localStorage',     // یا 'cookie' یا 'memory'
//     tokenKey: 'zenith_token',
//     refreshTokenKey: 'zenith_refresh_token',
//     autoRefresh: true,
//     refreshThreshold: 300,             // 5 دقیقه قبل از expiry
//   });
//
//   // در State:
//   const state = { auth: auth.signal, ... };
//
//   // در HTML:
//   <div zen-if="$auth.user">
//     خوش آمدید <span zen-text="$auth.user.name"></span>
//     <button zen-action="authLogout">خروج</button>
//   </div>
//   <div zen-if="!$auth.user">
//     <form zen-action:submit.prevent="authLogin">
//       <input name="email" placeholder="Email">
//       <input name="password" type="password" placeholder="Password">
//       <button type="submit">ورود</button>
//     </form>
//   </div>

import { signal, type Signal } from '@zenith/state';

/**
 * وضعیت کاربر فعلی.
 */
export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  roles?: string[];
  permissions?: string[];
  [key: string]: any;
}

/**
 * وضعیت Authentication.
 */
export interface AuthState {
  /** کاربر فعلی (null اگر لاگین نکرده). */
  user: AuthUser | null;
  /** آیا در حال loading است؟ */
  loading: boolean;
  /** آیا لاگین کرده؟ */
  isAuthenticated: boolean;
  /** Access token. */
  token: string | null;
  /** Refresh token. */
  refreshToken: string | null;
  /** زمان انقضای token (timestamp). */
  tokenExpiry: number | null;
  /** پیام خطا. */
  error: string | null;
}

/**
 * پیکربندی Auth.
 */
export interface AuthConfig {
  /** URL لاگین. */
  loginUrl: string;
  /** URL خروج. */
  logoutUrl?: string;
  /** URL refresh token. */
  refreshUrl?: string;
  /** URL دریافت کاربر فعلی. */
  meUrl?: string;
  /**
   * روش ذخیره token: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory'.
   *
   * SEC FIX (v1.2.6): SEC-A8 — the default is now `'memory'` (was
   * `'localStorage'` before v1.0.1). Storing tokens in `localStorage` makes
   * them readable by any JavaScript running on the page, so a single XSS
   * vulnerability anywhere in your dependency tree is enough to leak the
   * user's full session. `'memory'` limits the blast radius to the current
   * tab and survives only as long as the page is open, which is the safest
   * default. If you need cross-tab persistence, prefer server-side
   * `Set-Cookie` with `HttpOnly; Secure; SameSite=Strict` and use
   * `tokenStorage: 'cookie'` here only for non-sensitive metadata.
   */
  tokenStorage?: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory';
  /** کلید ذخیره access token. */
  tokenKey?: string;
  /** کلید ذخیره refresh token. */
  refreshTokenKey?: string;
  /** آیا auto-refresh فعال باشد؟ */
  autoRefresh?: boolean;
  /** چند ثانیه قبل از expiry، refresh انجام شود. */
  refreshThreshold?: number;
  /** نام field در response که token در آن است. */
  tokenField?: string;
  /** نام field در response که refresh token در آن است. */
  refreshTokenField?: string;
  /** نام field در response که user در آن است. */
  userField?: string;
  /** نام field در response که expiry در آن است (ثانیه). */
  expiresInField?: string;
  /** هدرهای اضافی. */
  headers?: Record<string, string>;
}

/**
 * IMP-AUT-02 (v1.3.0): رویدادهای Auth.
 */
export type AuthEvent =
  | 'login'
  | 'logout'
  | 'token-refresh'
  | 'token-expired'
  | 'error';

/**
 * IMP-AUT-02 (v1.3.0): Listener برای رویدادهای Auth.
 */
export type AuthEventListener = (event: AuthEvent, data?: any) => void;

/**
 * کلاس Auth — مدیریت کامل authentication.
 */
export class Auth {
  private _signal: Signal<AuthState>;
  private _config: Required<AuthConfig>;
  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;
  // BUG-12 FIX (v1.2.2): guard برای refresh race condition. اگر چندین caller
  // به‌طور همزمان refresh() را صدا بزنند، تنها یک درخواست refresh واقعی به
  // سرور می‌رود و بقیه‌ی callerها روی همان Promise منتظر می‌مانند.
  private _refreshPromise: Promise<boolean> | null = null;
  // BUG-12 FIX (v1.2.2): flag برای جلوگیری از استفاده‌ی Auth پس از destroy.
  // تمام متدهای عمومی این فلگ را چک می‌کنند و اگر true باشد، no-op برمی‌گردند.
  private _destroyed: boolean = false;
  // IMP-AUT-02 (v1.3.0): نگهداری listenerهای رویدادهای Auth.
  private _listeners = new Map<AuthEvent, Set<AuthEventListener>>();

  constructor(config: AuthConfig) {
    this._signal = signal<AuthState>({
      user: null,
      loading: false,
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      tokenExpiry: null,
      error: null,
    });

    this._config = {
      logoutUrl: '',
      refreshUrl: '',
      meUrl: '',
      // SEC FIX (v1.2.6): SEC-A8 — default tokenStorage changed from
      // 'localStorage' to 'memory'. localStorage is XSS-vulnerable: any script
      // running in the page (including third-party dependencies) can read the
      // user's token out of it. memory keeps the token in JS heap and dies
      // with the tab, which is the safest default. Callers who explicitly
      // opt into localStorage/sessionStorage/cookie should understand the
      // trade-off.
      tokenStorage: 'memory',
      tokenKey: 'zenith_token',
      refreshTokenKey: 'zenith_refresh_token',
      autoRefresh: true,
      refreshThreshold: 300,
      tokenField: 'token',
      refreshTokenField: 'refreshToken',
      userField: 'user',
      expiresInField: 'expiresIn',
      headers: {},
      ...config,
    };

    // Restore tokens from storage.
    this._restoreTokens();

    // BUG-AUT-04 (v1.3.0): اگر توکن معتبری وجود دارد، اطلاعات کاربر را
    // به‌صورت خودکار دریافت کن. قبلاً این کار انجام نمی‌شد و کاربر تا
    // اولین فراخوانی دستی fetchUser خالی می‌ماند.
    if (this._signal.get().token) {
      this.fetchUser().catch(() => {
        // اگر fetchUser ناموفق بود، logout کن
        this.logout();
      });
    }
  }

  /** دریافت Signal وضعیت. */
  get signal(): Signal<AuthState> {
    return this._signal;
  }

  /** آیا کاربر لاگین کرده؟ */
  get isAuthenticated(): boolean {
    return this._signal.get().isAuthenticated;
  }

  /** دریافت کاربر فعلی. */
  get user(): AuthUser | null {
    return this._signal.get().user;
  }

  /** دریافت token. */
  get token(): string | null {
    return this._signal.get().token;
  }

  /**
   * لاگین با email/password.
   *
   * @param credentials اعتبارنامه (مثل { email, password }).
   * @returns آیا لاگین موفق بود.
   */
  async login(credentials: Record<string, any>): Promise<boolean> {
    // BUG-12 FIX (v1.2.2): اگر Auth destroy شده، no-op برمی‌گردان.
    if (this._destroyed) return false;
    this._signal.set({ ...this._signal.get(), loading: true, error: null });

    try {
      const res = await fetch(this._config.loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._config.headers,
        },
        body: JSON.stringify(credentials),
        credentials: 'same-origin',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await res.json();

      // استخراج token, refresh token, user, expiry.
      const token = data[this._config.tokenField];
      const refreshToken = data[this._config.refreshTokenField];
      const user = data[this._config.userField];
      const expiresIn = data[this._config.expiresInField];

      if (!token) {
        throw new Error('No token in response');
      }

      const expiry = expiresIn ? Date.now() + expiresIn * 1000 : null;

      // ذخیره tokens.
      this._storeTokens(token, refreshToken, expiry);

      // آپدیت state.
      this._signal.set({
        user: user || null,
        loading: false,
        isAuthenticated: true,
        token,
        refreshToken,
        tokenExpiry: expiry,
        error: null,
      });

      // تنظیم auto-refresh.
      if (this._config.autoRefresh && expiry) {
        this._scheduleRefresh(expiry);
      }

      // IMP-AUT-02 (v1.3.0): انتشار رویداد login.
      this._emit('login', { user });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._signal.set({
        ...this._signal.get(),
        loading: false,
        error: message,
      });
      // IMP-AUT-02 (v1.3.0): انتشار رویداد error.
      this._emit('error', { message });
      return false;
    }
  }

  /**
   * خروج.
   */
  async logout(): Promise<void> {
    // BUG-12 FIX (v1.2.2): اگر Auth destroy شده، no-op برمی‌گردان.
    if (this._destroyed) return;
    // FIX (v1.2.3): فراخوانی logout API به‌صورت fire-and-forget — قبلاً await
    // می‌کردیم که باعث می‌شد در صورت کندی/قطعی سرور، پاک‌سازی محلی به تعویق
    // بیفتد و کاربر همچنان در حالت لاگین‌شده باقی بماند. حالا فقط fetch را
    // trigger می‌کنیم و بلافاصله (هم‌زمان) state محلی را پاک می‌کنیم.
    if (this._config.logoutUrl) {
      // SEC FIX (v1.2.6): SEC-A9 — keepalive + sendBeacon fallback so the
      // logout request still reaches the server when the user closes the
      // tab or navigates away immediately after clicking "Sign out".
      // `keepalive: true` lets the browser finish the POST even after the
      // page that initiated it is gone. sendBeacon is the older, more
      // universally supported fallback: it accepts only a single POST with
      // no headers, so we drop the Authorization header (the cookie, if
      // any, will still identify the user).
      try {
        fetch(this._config.logoutUrl, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Authorization': `Bearer ${this.token}`,
            ...this._config.headers,
          },
          credentials: 'same-origin',
        }).catch(() => {
          // SEC FIX (v1.2.6): SEC-A9 — fetch can fail if the page is being
          // torn down (AbortError) or if keepalive is unavailable. Fall
          // back to sendBeacon which is designed for exactly this case.
          try {
            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
              const blob = new Blob([''], { type: 'application/json' });
              navigator.sendBeacon(this._config.logoutUrl, blob);
            }
          } catch {
            // خطا در sendBeacon هم بی‌اثر است — state محلی زیرا پاک می‌شود.
          }
        });
      } catch {
        // خطای sync (مثل ساخت fetch) هم بی‌اثر است.
      }
    }

    // FIX (v1.2.3): همیشه state محلی را هم‌زمان پاک کن — مستقل از نتیجه‌ی API.
    // پاک کردن tokens.
    this._clearTokens();
    // Clear expiry too.
    const storage = this._getStorage();
    if (storage === 'cookie') {
      document.cookie = `${this._config.tokenKey}_expiry=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } else if (storage) {
      storage.removeItem(`${this._config.tokenKey}_expiry`);
    }

    // پاک کردن timer.
    this._clearRefreshTimer();

    // Reset state.
    this._signal.set({
      user: null,
      loading: false,
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      tokenExpiry: null,
      error: null,
    });

    // IMP-AUT-02 (v1.3.0): انتشار رویداد logout.
    this._emit('logout');
  }

  /**
   * Destroy: پاکسازی timers و state بدون API call.
   * مفید برای HMR و component unmount.
   */
  destroy(): void {
    // BUG-12 FIX (v1.2.2): set _destroyed flag تا متدهای عمومی بعد از destroy
    // no-op شوند. این کار از zombie callbacks (که بعد از destroy اجرا می‌شوند
    // و state را mutate می‌کنند) جلوگیری می‌کند.
    this._destroyed = true;
    this._clearRefreshTimer();
    // اگر refresh در حال انجام است، Promise را reject کن (با no-op چون فقط
    // Promise را null می‌کنیم — callerهای منتظر با دریافت false برمی‌گردند).
    this._refreshPromise = null;
    this._listeners.clear();
  }

  /**
   * دریافت اطلاعات کاربر فعلی از سرور.
   * مفید برای restore کردن session در زمان init.
   */
  async fetchUser(): Promise<boolean> {
    // BUG-12 FIX (v1.2.2): اگر Auth destroy شده، no-op برمی‌گردان.
    if (this._destroyed) return false;
    if (!this.token || !this._config.meUrl) return false;

    this._signal.set({ ...this._signal.get(), loading: true });

    try {
      const res = await fetch(this._config.meUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          ...this._config.headers,
        },
        credentials: 'same-origin',
      });

      if (!res.ok) {
        // اگر 401 بود، token نامعتبر است.
        if (res.status === 401) {
          await this.logout();
          return false;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const user = await res.json();

      this._signal.set({
        ...this._signal.get(),
        user,
        loading: false,
        isAuthenticated: true,
        error: null,
      });

      return true;
    } catch (err) {
      this._signal.set({
        ...this._signal.get(),
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * IMP-AUT-02 (v1.3.0): اشتراک در رویدادهای Auth.
   *
   * @param event   نام رویداد.
   * @param listener تابع callback.
   * @returns تابعی برای لغو اشتراک.
   */
  on(event: AuthEvent, listener: AuthEventListener): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
    return () => {
      this._listeners.get(event)?.delete(listener);
    };
  }

  /**
   * IMP-AUT-02 (v1.3.0): لغو اشتراک از رویداد.
   */
  off(event: AuthEvent, listener: AuthEventListener): void {
    this._listeners.get(event)?.delete(listener);
  }

  /**
   * IMP-AUT-02 (v1.3.0): انتشار داخلی رویداد.
   */
  private _emit(event: AuthEvent, data?: any): void {
    this._listeners.get(event)?.forEach(fn => {
      try {
        fn(event, data);
      } catch (err) {
        console.warn(`[Zenith] Auth event listener error for "${event}":`, err);
      }
    });
  }

  /**
   * BUG-AUT-03 (v1.3.0): Logout امن با sendBeacon + fallback.
   *
   * از `navigator.sendBeacon` برای ارسال درخواست logout حتی پس از بسته شدن
   * تب استفاده می‌کند. اگر sendBeacon پشتیبانی نشود، به `fetch` با
   * `keepalive: true` Fallback می‌کند.
   *
   * @param url آدرس endpoint logout (اختیاری — پیش‌فرض از config).
   */
  async secureLogout(url?: string): Promise<void> {
    if (this._destroyed) return;
    const logoutUrl = url || this._config.logoutUrl;
    if (!logoutUrl) {
      this._clearLocalState();
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(logoutUrl);
      } else {
        // Fallback: fetch با keepalive
        await fetch(logoutUrl, {
          method: 'POST',
          keepalive: true,
          credentials: 'include',
        });
      }
    } catch {
      // Silent fail — پاک‌سازی محلی مهم‌تر است
    }

    this._clearLocalState();
  }

  /**
   * BUG-AUT-04 (v1.3.0): پاکسازی state محلی.
   * توسط `logout` و `secureLogout` استفاده می‌شود.
   */
  private _clearLocalState(): void {
    this._clearRefreshTimer();
    this._refreshPromise = null;
    this._signal.set({
      user: null,
      loading: false,
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      tokenExpiry: null,
      error: null,
    });
    this._emit('logout');
  }

  /**
   * Refresh token.
   *
   * BUG-12 FIX (v1.2.2): refresh race condition guard. اگر چندین caller
   * به‌طور همزمان refresh() را صدا بزنند (مثلاً هم auto-refresh timer و هم
   * یک fetchUser که 401 گرفته)، فقط یک درخواست refresh واقعی به سرور می‌رود
   * و بقیه‌ی callerها روی همان Promise منتظر می‌مانند. این کار از token
   * rotation race (که می‌توانست منجر به invalid tokens شود) جلوگیری می‌کند.
   *
   * BUG-AUT-02 (v1.3.0): بازنشانی `_refreshPromise` در خطا با `finally`.
   * اگر refresh با خطا مواجه شود، `_refreshPromise` null می‌شود
   * تا درخواست بعدی بتواند دوباره تلاش کند.
   */
  async refresh(): Promise<boolean> {
    // BUG-12 FIX (v1.2.2): اگر Auth destroy شده، no-op برمی‌گردان.
    if (this._destroyed) return false;
    // اگر refresh در حال انجام است، همان Promise را برگردان.
    if (this._refreshPromise) return this._refreshPromise;
    if (!this._config.refreshUrl || !this._signal.get().refreshToken) return false;

    // BUG-12 FIX (v1.2.2): Promise را در _refreshPromise ذخیره کن تا callerهای
    // همزمان بتوانند روی آن منتظر بمانند. پس از اتمام (success یا failure)،
    // _refreshPromise را null کن تا refreshهای بعدی مجاز شوند.
    this._refreshPromise = this._doRefresh();

    this._refreshPromise = this._refreshPromise.finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  }

  /**
   * BUG-AUT-02 (v1.3.0): منطق واقعی refresh (جدا شده از race guard).
   */
  private async _doRefresh(): Promise<boolean> {
    try {
      const res = await fetch(this._config.refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._config.headers,
        },
        body: JSON.stringify({ refreshToken: this._signal.get().refreshToken }),
        credentials: 'same-origin',
      });

      if (!res.ok) {
        // FIX (v1.2.3): transient errors — فقط 401/403 (Unauthorized/
        // Forbidden) به معنای نامعتبر بودن refresh token هستند و باید logout
        // کنند. خطاهای 5xx (سرور) و 429 (Too Many Requests) موقتی هستند و
        // نباید منجر به logout شوند — فقط false برمی‌گردانیم تا caller بتواند
        // retry کند یا state فعلی را حفظ کند.
        if (res.status === 401 || res.status === 403) {
          this._emit('token-expired');
          await this.logout();
          return false;
        }
        if (res.status >= 500 || res.status === 429) {
          // Transient server error — don't logout, just return false.
          return false;
        }
        // سایر client errors (مثل 400/404) — احتمالاً refresh token نامعتبر
        // یا endpoint اشتباه است. logout کن تا state تمیز بماند.
        this._emit('token-expired');
        await this.logout();
        return false;
      }

      const data = await res.json();
      const token = data[this._config.tokenField];
      const refreshToken = data[this._config.refreshTokenField] || this._signal.get().refreshToken;
      const expiresIn = data[this._config.expiresInField];
      const expiry = expiresIn ? Date.now() + expiresIn * 1000 : null;

      this._storeTokens(token, refreshToken, expiry);

      // FIX (v1.2.3): پس از refresh موفق، isAuthenticated را true کن. این
      // برای _restoreTokens ضروری است که حالا isAuthenticated:false اولیه
      // را false نگه می‌دارد تا بعد از validation واقعی true شود.
      this._signal.set({
        ...this._signal.get(),
        token,
        refreshToken,
        tokenExpiry: expiry,
        isAuthenticated: true,
      });

      if (this._config.autoRefresh && expiry) {
        this._scheduleRefresh(expiry);
      }

      this._emit('token-refresh');

      return true;
    } catch {
      this._emit('token-expired');
      await this.logout();
      return false;
    }
  }

  /**
   * ایجاد headers با Authorization.
   * مفید برای استفاده در fetch های دیگر.
   */
  authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this._config.headers };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * بررسی اینکه آیا token در حال انقضا است.
   */
  isTokenExpiringSoon(): boolean {
    const expiry = this._signal.get().tokenExpiry;
    if (!expiry) return false;
    return Date.now() + this._config.refreshThreshold * 1000 >= expiry;
  }

  /**
   * تنظیم timer برای auto-refresh.
   *
   * IMP-AUT-04 (v1.3.0): اگر دستگاه آفلاین باشد، به‌جای ارسال درخواست
   * منتظر می‌ماند تا اتصال برگردد (رویداد online).
   */
  private _scheduleRefresh(expiry: number): void {
    // FIX (v1.2.9): BUG-08 — Guard against scheduling after destroy
    if (this._destroyed) return;
    this._clearRefreshTimer();

    // IMP-AUT-04 (v1.3.0): اگر آفلاین هستیم، صبر کن تا اتصال برگردد.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      window.addEventListener('online', () => {
        this._scheduleRefresh(expiry);
      }, { once: true });
      return;
    }

    // محاسبه زمان refresh (refreshThreshold ثانیه قبل از expiry).
    const refreshAt = expiry - this._config.refreshThreshold * 1000;
    const delay = Math.max(refreshAt - Date.now(), 1000);

    this._refreshTimer = setTimeout(() => {
      // FIX (v1.2.9): BUG-08 — Double-check _destroyed in callback
      if (this._destroyed) return;
      this.refresh();
    }, delay);
  }

  /**
   * BUG-AUT-01 (v1.3.0): پاکسازی متمرکز timer refresh.
   */
  private _clearRefreshTimer(): void {
    if (this._refreshTimer !== null) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  /**
   * ذخیره tokens در storage.
   *
   * SEC-1 FIX (v1.2.2): امنیت کوکی‌های سمت کلاینت بهبود یافت. قبلاً فقط
   * SameSite=Strict تنظیم می‌شد. حالا `Secure` هم اضافه شده تا کوکی فقط
   * روی HTTPS ارسال شود. نکته‌ی مهم: کوکی‌های set شده با document.cookie
   * نمی‌توانند HttpOnly باشند (این پراپرتی فقط server-side قابل set است).
   * اگر ذخیره‌ی HttpOnly لازم است، باید از cookie-based session با
   * Set-Cookie header در سرور استفاده کنید، نه از tokenStorage: 'cookie'
   * در این کلاس.
   */
  /**
   * SEC FIX (v1.2.6): SEC-A13 — CSRF implications of each tokenStorage mode.
   *
   * Cross-Site Request Forgery (CSRF) is the threat where an attacker site
   * tricks the user's browser into making an authenticated request to your
   * site. Zenith's auth layer does NOT add its own CSRF tokens; it relies on
   * the storage mode you pick:
   *
   *   - `memory` (default since v1.2.6): token lives in JS heap. It is NOT
   *     sent automatically on cross-origin requests, so CSRF is effectively
   *     impossible — attackers cannot read the token and cannot make the
   *     browser attach it. Best defence, but tokens do not survive reload.
   *
   *   - `localStorage` / `sessionStorage`: token is in JS heap. CSRF is also
   *     impossible here (same reason as memory), BUT any XSS in your page can
   *     read the token. Use only if you accept the XSS trade-off (see SEC-A8).
   *
   *   - `cookie` with `SameSite=Strict` (Zenith's default cookie attribute):
   *     browsers will NOT send the cookie on cross-site requests, so CSRF
   *     is blocked at the browser level. Caveats: `SameSite=Strict` breaks
   *     deep-linking from external sites (the user lands unauthenticated).
   *     For top-level navigation flows that need to preserve auth, switch to
   *     `SameSite=Lax` and add a real CSRF-token mechanism (double-submit
   *     cookie or synchroniser token) on every state-changing endpoint.
   *
   * Server-side guidance: regardless of which mode you pick, ALWAYS verify
   * `Origin` / `Referer` headers on state-changing routes and reject requests
   * whose `Origin` is not allow-listed. SameSite cookies and Origin checks
   * together are the modern CSRF defence; explicit CSRF tokens are still
   * recommended for high-value endpoints (login, password change, money
   * transfer, ...).
   */
  private _storeTokens(token: string, refreshToken?: string, expiry?: number | null): void {
    const storage = this._getStorage();
    if (storage === 'cookie') {
      // SEC-1 FIX (v1.2.2): Secure + SameSite=Strict. warning: client-side
      // cookies are NOT HttpOnly — for HttpOnly, use server-side Set-Cookie.
      document.cookie = `${this._config.tokenKey}=${token}; path=/; SameSite=Strict; Secure`;
      if (refreshToken) {
        document.cookie = `${this._config.refreshTokenKey}=${refreshToken}; path=/; SameSite=Strict; Secure`;
      }
      // Note: HttpOnly cannot be set via document.cookie — only server-side.
      // Store expiry for auto-refresh restoration.
      if (expiry) {
        document.cookie = `${this._config.tokenKey}_expiry=${expiry}; path=/; SameSite=Strict; Secure`;
      }
    } else if (storage) {
      storage.setItem(this._config.tokenKey, token);
      if (refreshToken) {
        storage.setItem(this._config.refreshTokenKey, refreshToken);
      }
      if (expiry) {
        storage.setItem(`${this._config.tokenKey}_expiry`, String(expiry));
      }
    }
  }

  /**
   * خواندن tokens از storage.
   */
  private _restoreTokens(): void {
    const storage = this._getStorage();
    let token: string | null = null;
    let refreshToken: string | null = null;

    if (storage === 'cookie') {
      token = this._getCookie(this._config.tokenKey);
      refreshToken = this._getCookie(this._config.refreshTokenKey);
    } else if (storage) {
      token = storage.getItem(this._config.tokenKey);
      refreshToken = storage.getItem(this._config.refreshTokenKey);
    }

    if (token) {
      // Restore expiry for auto-refresh.
      let expiry: number | null = null;
      if (storage === 'cookie') {
        const expStr = this._getCookie(`${this._config.tokenKey}_expiry`);
        if (expStr) expiry = Number(expStr);
      } else if (storage) {
        const expStr = storage.getItem(`${this._config.tokenKey}_expiry`);
        if (expStr) expiry = Number(expStr);
      }

      // FIX (v1.2.3): در ابتدا isAuthenticated:false — فقط بعد از validation
      // (یعنی refresh یا fetchUser موفق) روی true تنظیم می‌شود. قبلاً با وجود
      // token در storage، isAuthenticated:true تنظیم می‌شد که می‌توانست منجر به
      // نمایش UI لاگین‌شده برای کاربری با token نامعتبر (مثلاً server-side revoke
      // شده) شود.
      this._signal.set({
        ...this._signal.get(),
        token,
        refreshToken,
        tokenExpiry: expiry,
        isAuthenticated: false,
      });

      // Schedule auto-refresh if expiry is in the future.
      if (this._config.autoRefresh && expiry && expiry > Date.now()) {
        // FIX (v1.2.3): token معتبر به‌نظر می‌رسد — یک refresh فوری برای
        // validation انجام بده تا isAuthenticated:true شود.
        if (this._config.refreshUrl && refreshToken) {
          this.refresh();
        } else {
          // بدون refreshUrl، فقط fetchUser می‌تواند اعتبارسنجی کند. اگر meUrl
          // موجود است، آن را صدا بزن. در غیر این صورت، هیچ راهی برای validation
          // نیست — isAuthenticated:false باقی می‌ماند.
          if (this._config.meUrl) {
            this.fetchUser();
          }
        }
        this._scheduleRefresh(expiry);
      } else if (expiry && expiry <= Date.now()) {
        // Token already expired — try refresh.
        if (this._config.refreshUrl && refreshToken) {
          this.refresh();
        } else {
          this.logout();
        }
      } else {
        // No expiry info — try fetchUser to validate.
        if (this._config.meUrl) {
          this.fetchUser();
        }
      }
    }
  }

  /**
   * پاک کردن tokens از storage.
   */
  private _clearTokens(): void {
    const storage = this._getStorage();
    if (storage === 'cookie') {
      document.cookie = `${this._config.tokenKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = `${this._config.refreshTokenKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } else if (storage) {
      storage.removeItem(this._config.tokenKey);
      storage.removeItem(this._config.refreshTokenKey);
    }
  }

  /**
   * دریافت storage object.
   */
  private _getStorage(): Storage | 'cookie' | null {
    // BUG-06 (v1.0.1): بررسی واقعی SSR — JSDOM هم localStorage دارد ولی باید در SSR null برگرداند.
    const isServer = typeof window === 'undefined' ||
      (typeof process !== 'undefined' && process.versions?.node && typeof document !== 'undefined' &&
       (document as any).__zenithSSR__ === true);
    if (isServer && this._config.tokenStorage !== 'cookie' && this._config.tokenStorage !== 'memory') {
      return null;
    }

    switch (this._config.tokenStorage) {
      case 'localStorage':
        return typeof localStorage !== 'undefined' ? localStorage : null;
      case 'sessionStorage':
        return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
      case 'cookie':
        return 'cookie';
      default:
        return null;
    }
  }

  /**
   * خواندن cookie با نام.
   */
  private _getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? (match[2] ?? null) : null;
  }
}

/**
 * ساخت یک Auth instance.
 */
export function createAuth(config: AuthConfig): Auth {
  return new Auth(config);
}

/**
 * Registry از Auth instances.
 */
const authRegistry = new Map<string, Auth>();

/**
 * ثبت یک Auth.
 */
export function registerAuth(name: string, auth: Auth): void {
  authRegistry.set(name, auth);
}

/**
 * دریافت Auth با نام.
 */
export function getAuth(name: string = 'default'): Auth | undefined {
  return authRegistry.get(name);
}

/**
 * پاکسازی همه‌ی Auth instances (برای تست‌ها).
 */
export function clearAuth(): void {
  authRegistry.clear();
}

// ============================================================
// FEATURE (v1.4.0): Functional Auth API
// ============================================================

import { computed, emitError, type ReadonlySignal } from '@zenith/state';

export interface User {
  id: string | number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  [key: string]: any;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface FunctionalAuthState {
  user: Signal<User | null>;
  tokens: Signal<AuthTokens | null>;
  isAuthenticated: ReadonlySignal<boolean>;
  isLoading: Signal<boolean>;
  error: Signal<string | null>;
  roles: ReadonlySignal<string[]>;
  permissions: ReadonlySignal<string[]>;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  [key: string]: any;
}

export interface FunctionalAuthConfig {
  endpoints?: {
    login?: string;
    logout?: string;
    register?: string;
    refresh?: string;
    me?: string;
  };
  storageKey?: string;
  autoRefresh?: boolean;
  loginRedirect?: string;
  logoutRedirect?: string;
  loginPath?: string;
}

const FUNCTIONAL_STORAGE_KEY = 'zenith_auth_tokens';

let functionalConfig: FunctionalAuthConfig = {
  endpoints: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    register: '/api/auth/register',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me'
  },
  storageKey: FUNCTIONAL_STORAGE_KEY,
  autoRefresh: true,
  loginRedirect: '/dashboard',
  logoutRedirect: '/',
  loginPath: '/login'
};

const functionalUser = signal<User | null>(null);
const functionalTokens = signal<AuthTokens | null>(null);
const functionalIsLoading = signal(false);
const functionalAuthError = signal<string | null>(null);

const functionalIsAuthenticated = computed(() => !!functionalUser.get() && !!functionalTokens.get());
const functionalRoles = computed(() => functionalUser.get()?.roles || []);
const functionalPermissions = computed(() => functionalUser.get()?.permissions || []);

let functionalRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let functionalInitialized = false;

export function configureAuth(cfg: Partial<FunctionalAuthConfig>): void {
  functionalConfig = {
    ...functionalConfig,
    ...cfg,
    endpoints: { ...functionalConfig.endpoints, ...cfg.endpoints }
  };
}

export function getAuthConfig(): FunctionalAuthConfig {
  return { ...functionalConfig };
}

function saveFunctionalTokens(t: AuthTokens): void {
  try {
    localStorage.setItem(functionalConfig.storageKey || FUNCTIONAL_STORAGE_KEY, JSON.stringify(t));
  } catch (e) {
    console.warn('Cannot save tokens to storage:', e);
  }
}

function loadFunctionalTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(functionalConfig.storageKey || FUNCTIONAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearFunctionalTokens(): void {
  try {
    localStorage.removeItem(functionalConfig.storageKey || FUNCTIONAL_STORAGE_KEY);
  } catch { /* ignore */ }
}

export async function initAuth(): Promise<void> {
  if (functionalInitialized) return;
  functionalInitialized = true;

  const savedTokens = loadFunctionalTokens();
  if (savedTokens) {
    functionalTokens.set(savedTokens);
    try {
      await fetchCurrentUser();
    } catch {
      clearFunctionalAuthState();
    }
  }

  if (functionalConfig.autoRefresh) {
    setupFunctionalAutoRefresh();
  }
}

export async function login(credentials: LoginCredentials): Promise<User | null> {
  functionalIsLoading.set(true);
  functionalAuthError.set(null);

  try {
    const { http } = await import('@zenith/http');
    const response = await http.post<{ user: User; tokens: AuthTokens }>(
      functionalConfig.endpoints?.login || '/api/auth/login',
      credentials
    );

    const { user: newUser, tokens: newTokens } = response.data;

    functionalUser.set(newUser);
    functionalTokens.set(newTokens);

    if (credentials.remember) {
      saveFunctionalTokens(newTokens);
    }

    if (functionalConfig.autoRefresh) setupFunctionalAutoRefresh();

    return newUser;
  } catch (e: any) {
    const message = e?.data?.message || e?.message || 'Login failed';
    functionalAuthError.set(message);
    emitError({
      message,
      category: 'runtime',
      severity: 'error',
      recoverable: true,
      context: { phase: 'login' }
    });
    return null;
  } finally {
    functionalIsLoading.set(false);
  }
}

export async function register(data: RegisterData): Promise<User | null> {
  functionalIsLoading.set(true);
  functionalAuthError.set(null);

  try {
    const { http } = await import('@zenith/http');
    const response = await http.post<{ user: User; tokens: AuthTokens }>(
      functionalConfig.endpoints?.register || '/api/auth/register',
      data
    );

    const { user: newUser, tokens: newTokens } = response.data;

    functionalUser.set(newUser);
    functionalTokens.set(newTokens);
    saveFunctionalTokens(newTokens);

    return newUser;
  } catch (e: any) {
    const message = e?.data?.message || e?.message || 'Registration failed';
    functionalAuthError.set(message);
    return null;
  } finally {
    functionalIsLoading.set(false);
  }
}

export async function logout(notifyServer = true): Promise<void> {
  functionalIsLoading.set(true);

  try {
    if (notifyServer && functionalTokens.get()) {
      const { http } = await import('@zenith/http');
      await http.post(functionalConfig.endpoints?.logout || '/api/auth/logout', {}).catch(() => {});
    }
  } finally {
    clearFunctionalAuthState();
    clearFunctionalTokens();
    if (functionalRefreshTimer) {
      clearTimeout(functionalRefreshTimer);
      functionalRefreshTimer = null;
    }
    functionalIsLoading.set(false);
  }
}

export async function refreshToken(): Promise<AuthTokens | null> {
  const currentTokens = functionalTokens.get();
  if (!currentTokens?.refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const { http } = await import('@zenith/http');
    const response = await http.post<AuthTokens>(
      functionalConfig.endpoints?.refresh || '/api/auth/refresh',
      { refreshToken: currentTokens.refreshToken }
    );

    functionalTokens.set(response.data);
    saveFunctionalTokens(response.data);
    return response.data;
  } catch (e) {
    clearFunctionalAuthState();
    throw e;
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const { http } = await import('@zenith/http');
    const response = await http.get<User>(functionalConfig.endpoints?.me || '/api/auth/me');
    functionalUser.set(response.data);
    return response.data;
  } catch (e) {
    clearFunctionalAuthState();
    throw e;
  }
}

function clearFunctionalAuthState(): void {
  functionalUser.set(null);
  functionalTokens.set(null);
  functionalAuthError.set(null);
}

function setupFunctionalAutoRefresh(): void {
  if (functionalRefreshTimer) clearTimeout(functionalRefreshTimer);

  const currentTokens = functionalTokens.get();
  if (!currentTokens?.expiresAt) return;

  const refreshIn = Math.max(0, currentTokens.expiresAt - Date.now() - 60000);

  functionalRefreshTimer = setTimeout(async () => {
    try {
      await refreshToken();
    } catch {
      await logout(false);
    }
  }, refreshIn);
}

export function hasRole(role: string): boolean {
  return functionalRoles.get().includes(role);
}

export function hasAnyRole(roleList: string[]): boolean {
  return roleList.some(r => functionalRoles.get().includes(r));
}

export function hasAllRoles(roleList: string[]): boolean {
  return roleList.every(r => functionalRoles.get().includes(r));
}

export function hasPermission(permission: string): boolean {
  return functionalPermissions.get().includes(permission);
}

export function hasAnyPermission(permList: string[]): boolean {
  return permList.some(p => functionalPermissions.get().includes(p));
}

export interface RouteGuard {
  requiresAuth?: boolean;
  roles?: string[];
  permissions?: string[];
  canActivate?: () => boolean | Promise<boolean>;
  redirectTo?: string;
}

export async function canActivateRoute(guard: RouteGuard): Promise<{ allowed: boolean; redirectTo?: string }> {
  if (guard.requiresAuth && !functionalIsAuthenticated.get()) {
    return { allowed: false, redirectTo: guard.redirectTo || functionalConfig.loginPath };
  }

  if (guard.roles && guard.roles.length > 0) {
    if (!hasAnyRole(guard.roles)) {
      return { allowed: false, redirectTo: guard.redirectTo || '/forbidden' };
    }
  }

  if (guard.permissions && guard.permissions.length > 0) {
    if (!hasAnyPermission(guard.permissions)) {
      return { allowed: false, redirectTo: guard.redirectTo || '/forbidden' };
    }
  }

  if (guard.canActivate) {
    const allowed = await guard.canActivate();
    if (!allowed) {
      return { allowed: false, redirectTo: guard.redirectTo };
    }
  }

  return { allowed: true };
}

export const auth: FunctionalAuthState & {
  login: typeof login;
  logout: typeof logout;
  register: typeof register;
  refreshToken: typeof refreshToken;
  fetchUser: typeof fetchCurrentUser;
  hasRole: typeof hasRole;
  hasAnyRole: typeof hasAnyRole;
  hasAllRoles: typeof hasAllRoles;
  hasPermission: typeof hasPermission;
  hasAnyPermission: typeof hasAnyPermission;
  canActivateRoute: typeof canActivateRoute;
  configure: typeof configureAuth;
  init: typeof initAuth;
} = {
  user: functionalUser,
  tokens: functionalTokens,
  isAuthenticated: functionalIsAuthenticated,
  isLoading: functionalIsLoading,
  error: functionalAuthError,
  roles: functionalRoles,
  permissions: functionalPermissions,
  login,
  logout,
  register,
  refreshToken,
  fetchUser: fetchCurrentUser,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasPermission,
  hasAnyPermission,
  canActivateRoute,
  configure: configureAuth,
  init: initAuth
};
