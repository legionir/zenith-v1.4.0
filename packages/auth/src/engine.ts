import { signal, type Signal } from '@zenith/state';
import { deprecate } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { Disposable } from '@zenith/shared';
import { resolveAuthConfig } from './options';
import { SessionStorage } from './session-storage';
import { decodeAuthSession, decodeAuthUser, asAuthRecord } from './response';
import { assertAuthEndpoint, sendLogoutBeacon } from './host';
import { openAuthSynchronization } from './cross-tab';
import type { AuthState, AuthConfig, AuthUser, AuthTokens, AuthEvent, AuthEventListener } from './types';
/** Canonical owner of authentication state and request generations. @public */
export class Auth implements Disposable {
  private readonly _signal: Signal<AuthState>;
  private _config: Required<AuthConfig>;
  private _storage: SessionStorage;
  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private _refreshPromise: Promise<boolean> | null = null;
  private _initPromise: Promise<void> | null = null;
  private _initialized = false;
  private _destroyed = false;
  private _generation = 0;
  private readonly _requests = new Set<AbortController>();
  private readonly _listeners = new Map<AuthEvent, Set<AuthEventListener>>();
  private readonly _syncCleanups = new Set<() => void>();
  private _onlineCleanup: (() => void) | null = null;
  private _receivingSync = false;

  constructor(config: AuthConfig) {
    this._config = resolveAuthConfig(config);
    this._signal = signal<AuthState>({ user: null, loading: false, isAuthenticated: false,
      token: null, refreshToken: null, tokenExpiry: null, error: null });
    this._storage = new SessionStorage(this._config);
    this._warnPersistence();
    if (this._config.tokenStorage !== 'memory') void this.init();
  }

  get signal(): Signal<AuthState> { return this._signal; }
  get isAuthenticated(): boolean { return this._signal.get().isAuthenticated; }
  get user(): AuthUser | null { return this._signal.get().user; }
  get token(): string | null { return this._signal.get().token; }

  /** Detached configuration snapshot; mutation cannot change a running client. */
  getConfig(): Required<AuthConfig> { return { ...this._config, headers: { ...this._config.headers } }; }

  /** Reconfigure the same engine, invalidating in-flight work from the former configuration. */
  configure(config: Partial<AuthConfig>): void {
    if (this._destroyed) return;
    const next = resolveAuthConfig({ ...this._config, ...config });
    const storageChanged = next.storageKey !== this._config.storageKey ||
      next.tokenStorage !== this._config.tokenStorage || next.tokenKey !== this._config.tokenKey ||
      next.refreshTokenKey !== this._config.refreshTokenKey;
    this._invalidate();
    for (const stop of [...this._syncCleanups]) stop();
    if (storageChanged) {
      this._storage.clear();
      this._storage.dispose();
      this._resetState();
      this._initialized = false;
    } else this._signal.update(state => ({ ...state, loading: false }));
    this._config = next;
    if (storageChanged) this._storage = new SessionStorage(next);
    this._warnPersistence();
    const expiry = this._signal.peek().tokenExpiry;
    if (next.autoRefresh && expiry && this.token) this._scheduleRefresh(expiry);
  }

  private _warnPersistence(): void {
    if (this._config.tokenStorage !== 'memory' &&
      (globalThis as { __ZENITH_DEV__?: boolean }).__ZENITH_DEV__ !== false) {
      logger.debug(`[Zenith] ZEN-404: tokenStorage: '${this._config.tokenStorage}' exposes tokens to page JavaScript. ` +
        'Prefer access tokens in memory and server-set HttpOnly; Secure; SameSite cookies. See docs/security/auth.md.');
    }
  }

  /** Explicit init is the only way the memory-default client opts into restoring remember-me data. */
  init(): Promise<void> {
    if (this._destroyed) return Promise.resolve();
    if (this._initPromise) return this._initPromise;
    if (this._initialized) return Promise.resolve();
    this._initialized = true;
    const tokens = this._storage.restore(true);
    if (!tokens || this.token) return Promise.resolve();
    this._setTokens(tokens, false);
    const work = (async () => {
      if (tokens.expiresAt && tokens.expiresAt <= Date.now()) {
        if ((tokens.refreshToken || this._config.refreshMode === 'cookie') && this._config.refreshUrl) await this.refresh();
        else await this.logout(false);
      } else if (this._config.meUrl) await this.fetchUser();
      else if ((tokens.refreshToken || this._config.refreshMode === 'cookie') && this._config.refreshUrl) await this.refresh();
      const expiry = this._signal.peek().tokenExpiry;
      if (!this._destroyed && this.token && expiry && this._config.autoRefresh) this._scheduleRefresh(expiry);
    })();
    const lease = work.finally(() => { if (this._initPromise === lease) this._initPromise = null; });
    this._initPromise = lease;
    return lease;
  }

  async login(credentials: Record<string, unknown>, options?: { remember?: boolean }): Promise<boolean> {
    return this._authenticate(this._config.loginUrl, credentials, options?.remember, 'login');
  }

  async register(data: Record<string, unknown>, options?: { remember?: boolean }): Promise<boolean> {
    if (!this._config.registerUrl) return false;
    return this._authenticate(this._config.registerUrl, data, options?.remember, 'login');
  }

  private async _authenticate(url: string, credentials: Record<string, unknown>, remember: boolean | undefined,
    event: 'login'): Promise<boolean> {
    if (this._destroyed) return false;
    this._invalidate();
    this._initialized = true;
    const generation = this._generation;
    this._signal.update(state => ({ ...state, loading: true, error: null }));
    try {
      const response = await this._request(url, { method: 'POST', headers: this._jsonHeaders(),
        body: JSON.stringify(credentials) }, generation);
      if (!response || !this._current(generation)) return false;
      if (!response.ok) return this._fail(generation, 'Authentication failed');
      const session = this._session(response.data);
      if (!session) return this._fail(generation, 'Invalid authentication response');
      this._storage.save(session.tokens, remember);
      this._setTokens(session.tokens, true, session.user);
      this._scheduleSession();
      this._emit(event, { user: session.user });
      return true;
    } catch { return this._fail(generation, 'Authentication request failed'); }
  }

  /** Local invalidation is synchronous; a slow logout endpoint cannot retain the session. */
  async logout(notifyServer = true): Promise<void> {
    if (this._destroyed) return;
    const token = this.token;
    const url = this._config.logoutUrl;
    this._clearLocalState();
    if (!notifyServer || !url) return;
    try {
      assertAuthEndpoint(url);
      void fetch(url, { method: 'POST', keepalive: true, credentials: 'same-origin',
        headers: { ...this._config.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }).catch(() => { sendLogoutBeacon(url); });
    } catch { /* Local logout must succeed even if the endpoint is invalid. */ }
  }

  async secureLogout(url = this._config.logoutUrl): Promise<void> {
    if (this._destroyed) return;
    this._clearLocalState();
    if (!url) return;
    try {
      assertAuthEndpoint(url);
      if (sendLogoutBeacon(url)) return;
      void fetch(url, { method: 'POST', keepalive: true, credentials: 'include' }).catch(() => {});
    } catch { /* Never wait for network teardown to clear local state. */ }
  }

  private _clearLocalState(): void {
    this._invalidate();
    this._initialized = true;
    this._storage.clear();
    this._resetState();
    this._emit('logout');
  }

  private _resetState(): void {
    this._signal.set({ user: null, loading: false, isAuthenticated: false, token: null,
      refreshToken: null, tokenExpiry: null, error: null });
  }

  dispose(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._invalidate();
    for (const stop of [...this._syncCleanups]) stop();
    this._listeners.clear();
    this._storage.dispose();
    // Disposal releases the in-memory session, but is not a persistent/server logout.
    this._resetState();
    this._signal.dispose();
  }

  /** @deprecated Use dispose(); removed in 2.0.0. */
  destroy(): void {
    deprecate('ZEN-DEPR-020', 'auth.destroy()', 'auth.dispose()');
    this.dispose();
  }

  async fetchUser(): Promise<boolean> {
    if (this._destroyed || !this.token || !this._config.meUrl) return false;
    const generation = this._generation;
    this._signal.update(state => ({ ...state, loading: true }));
    try {
      const response = await this._request(this._config.meUrl, { headers: this.authHeaders() }, generation);
      if (!response || !this._current(generation)) return false;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) await this.logout(false);
        else this._fail(generation, 'User request failed');
        return false;
      }
      const data = response.data;
      const user = decodeAuthUser(asAuthRecord(data)?.[this._config.userField] ?? data);
      if (!user) return this._fail(generation, 'Invalid user response');
      this._signal.update(state => ({ ...state, user, isAuthenticated: true, loading: false, error: null }));
      return true;
    } catch { return this._fail(generation, 'User request failed'); }
  }

  refresh(): Promise<boolean> {
    if (this._destroyed) return Promise.resolve(false);
    if (this._refreshPromise) return this._refreshPromise;
    const refreshToken = this._signal.peek().refreshToken;
    if (!this._config.refreshUrl || (!refreshToken && this._config.refreshMode !== 'cookie')) return Promise.resolve(false);
    const generation = this._generation;
    const lease = this._doRefresh(refreshToken, generation).finally(() => {
      // A late completion must not release another session's single-flight lease.
      if (this._refreshPromise === lease) this._refreshPromise = null;
    });
    this._refreshPromise = lease;
    return lease;
  }

  private async _doRefresh(refreshToken: string | null, generation: number): Promise<boolean> {
    try {
      const response = await this._request(this._config.refreshUrl, { method: 'POST',
        headers: this._jsonHeaders(), body: JSON.stringify(this._config.refreshMode === 'cookie' ? {} : { refreshToken }) }, generation);
      if (!response || !this._current(generation)) return false;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this._emit('token-expired');
          if (this._current(generation)) await this.logout(false);
        } else this._retryRefresh();
        return false;
      }
      const session = this._session(response.data, true);
      if (!session) { this._retryRefresh(); return this._fail(generation, 'Invalid refresh response'); }
      this._storage.save(session.tokens);
      this._setTokens(session.tokens, true, session.user);
      this._scheduleSession();
      this._emit('token-refresh');
      return true;
    } catch {
      if (this._current(generation)) this._retryRefresh();
      return false;
    }
  }

  private _retryRefresh(): void {
    if (this._destroyed || !this.token || !this._config.autoRefresh) return;
    this._clearRefreshTimer();
    this._refreshTimer = setTimeout(() => { this._refreshTimer = null; void this.refresh(); }, 30_000);
  }

  authHeaders(): Record<string, string> {
    return { ...this._config.headers, ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) };
  }

  isTokenExpiringSoon(): boolean {
    const expiry = this._signal.get().tokenExpiry;
    return expiry !== null && Date.now() + this._config.refreshThreshold * 1000 >= expiry;
  }

  private _jsonHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...this._config.headers };
  }

  private _scheduleSession(): void {
    const expiry = this._signal.peek().tokenExpiry;
    if (this._config.autoRefresh && expiry) this._scheduleRefresh(expiry);
  }

  private _scheduleRefresh(expiry: number): void {
    if (this._destroyed) return;
    this._clearRefreshTimer();
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
      const resume = () => { this._onlineCleanup = null; this._scheduleRefresh(expiry); };
      window.addEventListener('online', resume, { once: true });
      this._onlineCleanup = () => window.removeEventListener('online', resume);
      return;
    }
    const generation = this._generation;
    const delay = Math.max(expiry - this._config.refreshThreshold * 1000 - Date.now(), 1000);
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null;
      if (this._current(generation)) void this.refresh();
    }, delay);
  }

  private _clearRefreshTimer(): void {
    if (this._refreshTimer !== null) clearTimeout(this._refreshTimer);
    this._refreshTimer = null;
    this._onlineCleanup?.();
    this._onlineCleanup = null;
  }

  private _invalidate(): void {
    this._generation++;
    this._clearRefreshTimer();
    for (const request of this._requests) request.abort();
    this._requests.clear();
    this._refreshPromise = null;
    this._initPromise = null;
  }

  private _current(generation: number): boolean { return !this._destroyed && generation === this._generation; }

  private async _request(url: string, init: RequestInit, generation: number): Promise<{
    ok: boolean; status: number; data: unknown;
  } | null> {
    if (!this._current(generation)) return null;
    assertAuthEndpoint(url);
    const controller = new AbortController();
    this._requests.add(controller);
    try {
      const response = await fetch(url, { ...init, credentials: 'same-origin', signal: controller.signal });
      if (!this._current(generation)) return null;
      // Never parse/emit an untrusted error body (which can echo credentials).
      const data: unknown = response.ok ? await response.json() : null;
      return this._current(generation) ? { ok: response.ok, status: response.status, data } : null;
    } finally { this._requests.delete(controller); }
  }

  private _fail(generation: number, message: string): false {
    if (this._current(generation)) {
      this._signal.update(state => ({ ...state, loading: false, error: message }));
      this._emit('error', { message });
    }
    return false;
  }

  private _session(value: unknown, refreshing = false): { tokens: AuthTokens; user: AuthUser | null } | null {
    return decodeAuthSession(value, { config: this._config, refreshing,
      previousRefreshToken: () => this._signal.peek().refreshToken, previousUser: () => this.user });
  }

  private _setTokens(tokens: AuthTokens, authenticated: boolean, user: AuthUser | null = null): void {
    this._signal.set({ user, token: tokens.accessToken, refreshToken: tokens.refreshToken ?? null,
      tokenExpiry: tokens.expiresAt ?? null, loading: false, isAuthenticated: authenticated, error: null });
  }

  on(event: AuthEvent, listener: AuthEventListener): () => void {
    if (this._destroyed) return () => {};
    const listeners = this._listeners.get(event) ?? new Set<AuthEventListener>();
    this._listeners.set(event, listeners);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
  off(event: AuthEvent, listener: AuthEventListener): void { this._listeners.get(event)?.delete(listener); }
  private _emit(event: AuthEvent, data?: unknown): void {
    for (const listener of [...(this._listeners.get(event) ?? [])]) {
      try { listener(event, data); } catch { logger.warn(`[Zenith] Auth listener failed (${event})`); }
    }
  }

  /** Owned, idempotent subscription. Messages contain invalidations, never credentials. */
  enableCrossTabSync(channelName = 'zenith:auth:sync'): () => void {
    if (this._destroyed) return () => {};
    const scope = this._storage.key;
    const receive = (type: 'logout' | 'refresh') => {
      if (this._destroyed) return;
      this._receivingSync = true;
      try {
        if (type === 'logout') this._clearLocalState();
        else if (this._storage.shared) {
          const tokens = this._storage.restore(true);
          if (tokens) {
            this._invalidate();
            this._setTokens(tokens, false);
            if (this._config.meUrl) void this.fetchUser();
            this._scheduleSession();
          }
        }
      } finally { this._receivingSync = false; }
    };
    const stop = openAuthSynchronization({ channelName, scope, receive,
      isReceiving: () => this._receivingSync, on: (event, listener) => this.on(event, listener),
      onStop: () => { this._syncCleanups.delete(stop); } });
    this._syncCleanups.add(stop);
    return stop;
  }

  /** Endpoint adapter only, not a complete MFA challenge/OTP protocol. */
  async verifyMfa(code: string, verifyUrl = `${this._config.loginUrl.replace(/\/$/, '')}/mfa`): Promise<boolean> {
    if (this._destroyed || !code) return false;
    const generation = this._generation;
    try {
      const response = await this._request(verifyUrl, { method: 'POST',
        headers: { ...this._jsonHeaders(), ...this.authHeaders() }, body: JSON.stringify({ code }) }, generation);
      if (!response?.ok || !this._current(generation)) return false;
      const session = this._session(response.data, true);
      if (!session) return false;
      this._storage.save(session.tokens);
      this._setTokens(session.tokens, true, session.user);
      this._scheduleSession();
      return true;
    } catch { return false; }
  }
}

