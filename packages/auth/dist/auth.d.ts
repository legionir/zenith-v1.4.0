import { type Signal } from '@zenith/state';
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
    /** روش ذخیره token: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory'. */
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
 * کلاس Auth — مدیریت کامل authentication.
 */
export declare class Auth {
    private _signal;
    private _config;
    private _refreshTimer;
    constructor(config: AuthConfig);
    /** دریافت Signal وضعیت. */
    get signal(): Signal<AuthState>;
    /** آیا کاربر لاگین کرده؟ */
    get isAuthenticated(): boolean;
    /** دریافت کاربر فعلی. */
    get user(): AuthUser | null;
    /** دریافت token. */
    get token(): string | null;
    /**
     * لاگین با email/password.
     *
     * @param credentials اعتبارنامه (مثل { email, password }).
     * @returns آیا لاگین موفق بود.
     */
    login(credentials: Record<string, any>): Promise<boolean>;
    /**
     * خروج.
     */
    logout(): Promise<void>;
    /**
     * Destroy: پاکسازی timers و state بدون API call.
     * مفید برای HMR و component unmount.
     */
    destroy(): void;
    /**
     * دریافت اطلاعات کاربر فعلی از سرور.
     * مفید برای restore کردن session در زمان init.
     */
    fetchUser(): Promise<boolean>;
    /**
     * Refresh token.
     */
    refresh(): Promise<boolean>;
    /**
     * ایجاد headers با Authorization.
     * مفید برای استفاده در fetch های دیگر.
     */
    authHeaders(): Record<string, string>;
    /**
     * بررسی اینکه آیا token در حال انقضا است.
     */
    isTokenExpiringSoon(): boolean;
    /**
     * تنظیم timer برای auto-refresh.
     */
    private _scheduleRefresh;
    /**
     * ذخیره tokens در storage.
     */
    private _storeTokens;
    /**
     * خواندن tokens از storage.
     */
    private _restoreTokens;
    /**
     * پاک کردن tokens از storage.
     */
    private _clearTokens;
    /**
     * دریافت storage object.
     */
    private _getStorage;
    /**
     * خواندن cookie با نام.
     */
    private _getCookie;
}
/**
 * ساخت یک Auth instance.
 */
export declare function createAuth(config: AuthConfig): Auth;
/**
 * ثبت یک Auth.
 */
export declare function registerAuth(name: string, auth: Auth): void;
/**
 * دریافت Auth با نام.
 */
export declare function getAuth(name?: string): Auth | undefined;
/**
 * پاکسازی همه‌ی Auth instances (برای تست‌ها).
 */
export declare function clearAuth(): void;
