import { createStorage, driverByName, type StorageDriver, type ZenithStorage } from '@zenith/storage';
import type { AuthConfig, AuthTokens } from './types';

/** Internal boundary: never persist an unchecked response or an error body. */
export function isAuthTokens(value: unknown): value is AuthTokens {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.accessToken === 'string' && v.accessToken.length > 0 &&
    (v.refreshToken === undefined || (typeof v.refreshToken === 'string' && v.refreshToken.length > 0)) &&
    (v.expiresAt === undefined || (typeof v.expiresAt === 'number' && Number.isFinite(v.expiresAt) && v.expiresAt > 0));
}

/** One storage adapter for both public styles; memory never implicitly reads localStorage. */
export class SessionStorage {
  private readonly driver: StorageDriver;
  private readonly store: ZenithStorage;
  private remembered: ZenithStorage | undefined;
  private remembering = false;
  private readonly server = typeof window === 'undefined' ||
    (typeof document !== 'undefined' && (document as Document & { __zenithSSR__?: boolean }).__zenithSSR__ === true);
  readonly key: string;

  constructor(private readonly config: Required<AuthConfig>) {
    this.key = config.storageKey || `${config.tokenKey}_session`;
    const mode = config.tokenStorage;
    this.driver = driverByName(this.server ? 'memory' : mode === 'localStorage' ? 'local' : mode === 'sessionStorage' ? 'session' : mode,
      { secure: true, sameSite: 'Strict', path: '/' });
    this.store = this.makeStore(this.driver);
  }

  private makeStore(driver: StorageDriver | 'local'): ZenithStorage {
    return createStorage({ driver: this.server ? 'memory' : driver, namespace: '', sync: false, migrate: old => old,
      validate: value => {
        if (!isAuthTokens(value)) throw new Error('Invalid authentication session');
        return value;
      },
    });
  }

  private rememberStore(): ZenithStorage {
    return this.remembered ??= this.makeStore('local');
  }

  get shared(): boolean {
    return !this.server && (this.remembering || this.config.tokenStorage === 'localStorage' || this.config.tokenStorage === 'cookie');
  }

  restore(allowRemembered = false): AuthTokens | null {
    if (this.server) return this.store.get<AuthTokens>(this.key) ?? null;
    let tokens: AuthTokens | null;
    if (this.config.tokenStorage === 'memory' && allowRemembered && this.config.storageKey) {
      tokens = this.rememberStore().get<AuthTokens>(this.key) ?? null;
      this.remembering = tokens !== null;
    } else tokens = this.store.get<AuthTokens>(this.key) ?? null;
    if (tokens || this.config.tokenStorage === 'memory') return tokens;

    // Only the migration boundary reads the former raw class keys. New writes
    // always use @zenith/storage's versioned, validated record under `key`.
    try {
      const accessToken = this.driver.get(this.config.tokenKey);
      const refreshToken = this.driver.get(this.config.refreshTokenKey);
      const rawExpiry = this.driver.get(`${this.config.tokenKey}_expiry`);
      const expiresAt = rawExpiry ? Number(rawExpiry) : undefined;
      const legacy = { accessToken, ...(refreshToken ? { refreshToken } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}) };
      if (!isAuthTokens(legacy)) return null;
      this.store.set(this.key, legacy);
      this.removeLegacyKeys();
      return legacy;
    } catch { return null; }
  }

  save(tokens: AuthTokens, remember?: boolean): void {
    if (!isAuthTokens(tokens)) return;
    if (remember !== undefined && this.config.tokenStorage === 'memory') {
      if (!remember && this.config.tokenStorage === 'memory' && (this.config.storageKey || this.remembering)) this.rememberStore().remove(this.key);
      this.remembering = remember;
    }
    this.store.set(this.key, tokens);
    if (this.config.tokenStorage === 'memory' && this.remembering) this.rememberStore().set(this.key, tokens);
    this.removeLegacyKeys();
  }

  clear(): void {
    this.store.remove(this.key);
    // Explicit logout also removes a remembered session not restored in this tab.
    if ((this.config.tokenStorage === 'memory' && this.config.storageKey) || this.remembering) this.rememberStore().remove(this.key);
    this.remembering = false;
    this.removeLegacyKeys();
  }

  dispose(): void { this.store.dispose(); this.remembered?.dispose(); }

  private removeLegacyKeys(): void {
    for (const key of [this.config.tokenKey, this.config.refreshTokenKey, `${this.config.tokenKey}_expiry`]) {
      if (key === this.key) continue;
      try { this.driver.remove(key); } catch { /* Storage failures must not retain live auth state. */ }
    }
  }
}
