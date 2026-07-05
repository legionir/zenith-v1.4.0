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
import { signal } from '@zenith/state';
/**
 * کلاس Auth — مدیریت کامل authentication.
 */
export class Auth {
    _signal;
    _config;
    _refreshTimer = null;
    // BUG-12 FIX (v1.2.2): refresh race condition guard.
    _refreshPromise = null;
    // BUG-12 FIX (v1.2.2): _destroyed flag — متدهای عمومی بعد از destroy no-op می‌شوند.
    _destroyed = false;
    constructor(config) {
        this._signal = signal({
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
            // 'localStorage' to 'memory'. localStorage is XSS-vulnerable: any
            // script running in the page can read the user's token out of it.
            // memory keeps the token in JS heap and dies with the tab.
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
    }
    /** دریافت Signal وضعیت. */
    get signal() {
        return this._signal;
    }
    /** آیا کاربر لاگین کرده؟ */
    get isAuthenticated() {
        return this._signal.get().isAuthenticated;
    }
    /** دریافت کاربر فعلی. */
    get user() {
        return this._signal.get().user;
    }
    /** دریافت token. */
    get token() {
        return this._signal.get().token;
    }
    /**
     * لاگین با email/password.
     *
     * @param credentials اعتبارنامه (مثل { email, password }).
     * @returns آیا لاگین موفق بود.
     */
    async login(credentials) {
        // BUG-12 FIX (v1.2.2): no-op if destroyed.
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
            return true;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this._signal.set({
                ...this._signal.get(),
                loading: false,
                error: message,
            });
            return false;
        }
    }
    /**
     * خروج.
     */
    async logout() {
        // BUG-12 FIX (v1.2.2): no-op if destroyed.
        if (this._destroyed) return;
        // FIX (v1.2.3): fire-and-forget logout API call.
        if (this._config.logoutUrl) {
            // SEC FIX (v1.2.6): SEC-A9 — keepalive + sendBeacon fallback so the
            // logout request still reaches the server when the user closes the
            // tab or navigates away immediately after clicking "Sign out".
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
                    // SEC FIX (v1.2.6): SEC-A9 — fetch can fail if the page is
                    // being torn down (AbortError) or keepalive is unavailable.
                    // Fall back to sendBeacon which is designed for this case.
                    try {
                        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                            const blob = new Blob([''], { type: 'application/json' });
                            navigator.sendBeacon(this._config.logoutUrl, blob);
                        }
                    }
                    catch {
                        // state محلی زیرا پاک می‌شود.
                    }
                });
            }
            catch {
                // خطای sync (مثل ساخت fetch) هم بی‌اثر است.
            }
        }
        // FIX (v1.2.3): همیشه state محلی را هم‌زمان پاک کن — مستقل از API.
        // پاک کردن tokens.
        this._clearTokens();
        // Clear expiry too.
        const storage = this._getStorage();
        if (storage === 'cookie') {
            document.cookie = `${this._config.tokenKey}_expiry=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
        else if (storage) {
            storage.removeItem(`${this._config.tokenKey}_expiry`);
        }
        // پاک کردن timer.
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
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
    }
    /**
     * Destroy: پاکسازی timers و state بدون API call.
     * مفید برای HMR و component unmount.
     */
    destroy() {
        // BUG-12 FIX (v1.2.2): set _destroyed flag.
        this._destroyed = true;
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
        // BUG-12 FIX (v1.2.2): clear in-flight refresh promise.
        this._refreshPromise = null;
    }
    /**
     * دریافت اطلاعات کاربر فعلی از سرور.
     * مفید برای restore کردن session در زمان init.
     */
    async fetchUser() {
        // BUG-12 FIX (v1.2.2): no-op if destroyed.
        if (this._destroyed) return false;
        if (!this.token || !this._config.meUrl)
            return false;
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
        }
        catch (err) {
            this._signal.set({
                ...this._signal.get(),
                loading: false,
                error: err instanceof Error ? err.message : String(err),
            });
            return false;
        }
    }
    /**
     * Refresh token.
     *
     * BUG-12 FIX (v1.2.2): refresh race condition guard. اگر چندین caller
     * همزمان refresh() را صدا بزنند، فقط یک درخواست واقعی به سرور می‌رود.
     */
    async refresh() {
        // BUG-12 FIX (v1.2.2): no-op if destroyed.
        if (this._destroyed) return false;
        // اگر refresh در حال انجام است، همان Promise را برگردان.
        if (this._refreshPromise) return this._refreshPromise;
        if (!this._config.refreshUrl || !this._signal.get().refreshToken)
            return false;
        // BUG-12 FIX (v1.2.2): Promise را در _refreshPromise ذخیره کن تا callerهای
        // همزمان روی آن منتظر بمانند. در پایان null می‌شود.
        this._refreshPromise = (async () => {
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
                    // FIX (v1.2.3): transient errors — فقط 401/403 logout می‌کنند.
                    // 5xx و 429 موقتی هستند و نباید logout شوند — فقط false.
                    if (res.status === 401 || res.status === 403) {
                        await this.logout();
                        return false;
                    }
                    if (res.status >= 500 || res.status === 429) {
                        // Transient server error — don't logout, just return false.
                        return false;
                    }
                    // سایر client errors — logout برای state تمیز.
                    await this.logout();
                    return false;
                }
                const data = await res.json();
                const token = data[this._config.tokenField];
                const refreshToken = data[this._config.refreshTokenField] || this._signal.get().refreshToken;
                const expiresIn = data[this._config.expiresInField];
                const expiry = expiresIn ? Date.now() + expiresIn * 1000 : null;
                this._storeTokens(token, refreshToken, expiry);
                // FIX (v1.2.3): پس از refresh موفق، isAuthenticated:true.
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
                return true;
            }
            catch {
                await this.logout();
                return false;
            }
            finally {
                // BUG-12 FIX (v1.2.2): clear _refreshPromise در پایان.
                this._refreshPromise = null;
            }
        })();
        return this._refreshPromise;
    }
    /**
     * ایجاد headers با Authorization.
     * مفید برای استفاده در fetch های دیگر.
     */
    authHeaders() {
        const headers = { ...this._config.headers };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }
    /**
     * بررسی اینکه آیا token در حال انقضا است.
     */
    isTokenExpiringSoon() {
        const expiry = this._signal.get().tokenExpiry;
        if (!expiry)
            return false;
        return Date.now() + this._config.refreshThreshold * 1000 >= expiry;
    }
    /**
     * تنظیم timer برای auto-refresh.
     */
    _scheduleRefresh(expiry) {
        // FIX (v1.2.9): BUG-08 — Guard against scheduling after destroy
        if (this._destroyed)
            return;
        if (this._refreshTimer)
            clearTimeout(this._refreshTimer);
        // محاسبه زمان refresh (refreshThreshold ثانیه قبل از expiry).
        const refreshAt = expiry - this._config.refreshThreshold * 1000;
        const delay = Math.max(refreshAt - Date.now(), 1000);
        this._refreshTimer = setTimeout(() => {
            // FIX (v1.2.9): BUG-08 — Double-check _destroyed in callback
            if (this._destroyed)
                return;
            this.refresh();
        }, delay);
    }
    /**
     * ذخیره tokens در storage.
     *
     * SEC-1 FIX (v1.2.2): Secure + SameSite=Strict. warning: client-side
     * cookies are NOT HttpOnly — for HttpOnly, use server-side Set-Cookie.
     *
     * SEC FIX (v1.2.6): SEC-A13 — CSRF implications of each tokenStorage mode.
     * See the matching JSDoc in src/auth.ts for the full write-up. Summary:
     *   - memory (default): CSRF-proof (token not sent on cross-origin reqs).
     *   - localStorage/sessionStorage: CSRF-proof but XSS-vulnerable (SEC-A8).
     *   - cookie + SameSite=Strict (Zenith default): CSRF blocked at browser
     *     level. For SameSite=Lax flows, add explicit CSRF tokens server-side.
     * Always verify Origin/Referer on state-changing endpoints regardless.
     */
    _storeTokens(token, refreshToken, expiry) {
        const storage = this._getStorage();
        if (storage === 'cookie') {
            // SEC-1 FIX (v1.2.2): Secure flag added.
            document.cookie = `${this._config.tokenKey}=${token}; path=/; SameSite=Strict; Secure`;
            if (refreshToken) {
                document.cookie = `${this._config.refreshTokenKey}=${refreshToken}; path=/; SameSite=Strict; Secure`;
            }
            // Note: HttpOnly cannot be set via document.cookie — only server-side.
            // Store expiry for auto-refresh restoration.
            if (expiry) {
                document.cookie = `${this._config.tokenKey}_expiry=${expiry}; path=/; SameSite=Strict; Secure`;
            }
        }
        else if (storage) {
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
    _restoreTokens() {
        const storage = this._getStorage();
        let token = null;
        let refreshToken = null;
        if (storage === 'cookie') {
            token = this._getCookie(this._config.tokenKey);
            refreshToken = this._getCookie(this._config.refreshTokenKey);
        }
        else if (storage) {
            token = storage.getItem(this._config.tokenKey);
            refreshToken = storage.getItem(this._config.refreshTokenKey);
        }
        if (token) {
            // Restore expiry for auto-refresh.
            let expiry = null;
            if (storage === 'cookie') {
                const expStr = this._getCookie(`${this._config.tokenKey}_expiry`);
                if (expStr)
                    expiry = Number(expStr);
            }
            else if (storage) {
                const expStr = storage.getItem(`${this._config.tokenKey}_expiry`);
                if (expStr)
                    expiry = Number(expStr);
            }
            // FIX (v1.2.3): در ابتدا isAuthenticated:false — فقط بعد از validation
            // (refresh یا fetchUser موفق) روی true تنظیم می‌شود.
            this._signal.set({
                ...this._signal.get(),
                token,
                refreshToken,
                tokenExpiry: expiry,
                isAuthenticated: false,
            });
            // Schedule auto-refresh if expiry is in the future.
            if (this._config.autoRefresh && expiry && expiry > Date.now()) {
                // FIX (v1.2.3): refresh فوری برای validation تا isAuthenticated:true شود.
                if (this._config.refreshUrl && refreshToken) {
                    this.refresh();
                }
                else {
                    // بدون refreshUrl، فقط fetchUser می‌تواند اعتبارسنجی کند.
                    if (this._config.meUrl) {
                        this.fetchUser();
                    }
                }
                this._scheduleRefresh(expiry);
            }
            else if (expiry && expiry <= Date.now()) {
                // Token already expired — try refresh.
                if (this._config.refreshUrl && refreshToken) {
                    this.refresh();
                }
                else {
                    this.logout();
                }
            }
            else {
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
    _clearTokens() {
        const storage = this._getStorage();
        if (storage === 'cookie') {
            document.cookie = `${this._config.tokenKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            document.cookie = `${this._config.refreshTokenKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
        else if (storage) {
            storage.removeItem(this._config.tokenKey);
            storage.removeItem(this._config.refreshTokenKey);
        }
    }
    /**
     * دریافت storage object.
     */
    _getStorage() {
        // BUG-06 (v1.0.1): بررسی واقعی SSR
        const isServer = typeof window === 'undefined' ||
            (typeof process !== 'undefined' && process.versions?.node && typeof document !== 'undefined' &&
             document.__zenithSSR__ === true);
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
    _getCookie(name) {
        if (typeof document === 'undefined')
            return null;
        const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
        return match ? (match[2] ?? null) : null;
    }
}
/**
 * ساخت یک Auth instance.
 */
export function createAuth(config) {
    return new Auth(config);
}
/**
 * Registry از Auth instances.
 */
const authRegistry = new Map();
/**
 * ثبت یک Auth.
 */
export function registerAuth(name, auth) {
    authRegistry.set(name, auth);
}
/**
 * دریافت Auth با نام.
 */
export function getAuth(name = 'default') {
    return authRegistry.get(name);
}
/**
 * پاکسازی همه‌ی Auth instances (برای تست‌ها).
 */
export function clearAuth() {
    authRegistry.clear();
}
//# sourceMappingURL=auth.js.map