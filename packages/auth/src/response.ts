import type { AuthConfig, AuthUser, AuthTokens } from './types';
import { isAuthTokens } from './session-storage';
interface SessionDecodeOptions { config: Required<AuthConfig>; refreshing: boolean; previousRefreshToken(): string | null; previousUser(): AuthUser | null; }
export function asAuthRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }

export function decodeAuthUser(value: unknown): AuthUser | null {
    const user = asAuthRecord(value);
    if (!user || (typeof user.id !== 'number' && typeof user.id !== 'string')) return null;
    return { ...user, id: user.id, name: typeof user.name === 'string' ? user.name : '',
      email: typeof user.email === 'string' ? user.email : '',
      roles: Array.isArray(user.roles) ? user.roles.filter((role): role is string => typeof role === 'string') : [],
      permissions: Array.isArray(user.permissions) ? user.permissions.filter((permission): permission is string => typeof permission === 'string') : [],
    };
  }

export function decodeAuthSession(value: unknown, options: SessionDecodeOptions): { tokens: AuthTokens; user: AuthUser | null } | null {
    const data = asAuthRecord(value);
    if (!data) return null;
    const nested = asAuthRecord(data.tokens);
    const raw = nested ?? data;
    const accessToken = raw[options.config.tokenField] ?? raw.accessToken;
    const refreshToken = raw[options.config.refreshTokenField] ?? (options.refreshing ? options.previousRefreshToken() : undefined);
    const expiresIn = raw[options.config.expiresInField];
    if (expiresIn !== undefined && (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0)) return null;
    const expiresAt = expiresIn !== undefined ? Date.now() + (expiresIn as number) * 1000 : raw.expiresAt;
    const tokens = { accessToken, ...(refreshToken ? { refreshToken } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}) };
    if (!isAuthTokens(tokens)) return null;
    const rawUser = data[options.config.userField];
    const user = rawUser === undefined && options.refreshing ? options.previousUser() : decodeAuthUser(rawUser);
    if (rawUser != null && !user) return null;
    return { tokens, user };
  }

