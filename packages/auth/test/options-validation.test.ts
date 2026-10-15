// #52 — اعتبارسنجی گزینه‌های @zenith/auth در مرز ورودی (AuthConfig + FunctionalAuthConfig)
import { describe, it, expect, beforeEach } from 'vitest';
import { ZenithError } from '@zenith/errors';
import { setSchemaWarnReporter } from '@zenith/schema';
import {
  Auth,
  createAuth,
  configureAuth,
  getAuthConfig,
  authConfigOptions,
  AUTH_CONFIG_DEFAULTS,
  resolveAuthConfig,
  functionalAuthConfigOptions,
  FUNCTIONAL_AUTH_CONFIG_DEFAULTS,
  resolveFunctionalAuthConfig,
} from '../src/index';

function catchError(fn: () => unknown): ZenithError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ZenithError);
    return err as ZenithError;
  }
  throw new Error('Expected function to throw ZenithError');
}

describe('@zenith/auth options validation (#52)', () => {
  beforeEach(() => {
    configureAuth(FUNCTIONAL_AUTH_CONFIG_DEFAULTS);
  });

  describe('AuthConfig (new Auth / createAuth / resolveAuthConfig)', () => {
    it('exports frozen AUTH_CONFIG_DEFAULTS and resolves defaults when loginUrl is provided', () => {
      expect(Object.isFrozen(AUTH_CONFIG_DEFAULTS)).toBe(true);
      const resolved = resolveAuthConfig({ loginUrl: '/api/login' });
      expect(resolved).toEqual({
        loginUrl: '/api/login',
        logoutUrl: '',
        refreshUrl: '',
        meUrl: '',
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
      });
    });

    it('rejects missing or empty loginUrl with ZenithError (ZEN-1001 / ZEN-1004)', () => {
      const missingErr = catchError(() => createAuth({} as any));
      expect(missingErr.code).toBe('ZEN-1001');
      expect((missingErr.details as any).path).toBe('loginUrl');

      const emptyErr = catchError(() => new Auth({ loginUrl: '' }));
      expect(emptyErr.code).toBe('ZEN-1004');
      expect((emptyErr.details as any).path).toBe('loginUrl');
    });

    it('rejects negative refreshThreshold with ZEN-1004 and invalid tokenStorage enum with ZEN-1001', () => {
      const negErr = catchError(() =>
        createAuth({ loginUrl: '/api/login', refreshThreshold: -10 }),
      );
      expect(negErr.code).toBe('ZEN-1004');
      expect((negErr.details as any).path).toBe('refreshThreshold');
      expect((negErr.details as any).expected).toContain('≥ 0');

      const enumErr = catchError(() =>
        createAuth({ loginUrl: '/api/login', tokenStorage: 'indexedDB' as any }),
      );
      expect(enumErr.code).toBe('ZEN-1001');
      expect((enumErr.details as any).path).toBe('tokenStorage');
      expect((enumErr.details as any).expected).toContain('enum');
    });

    it('rejects unknown keys in dev mode with ZEN-1002 and reports in warn mode', () => {
      const unknownErr = catchError(() =>
        createAuth({ loginUrl: '/api/login', loginEndpoint: '/x' } as any),
      );
      expect(unknownErr.code).toBe('ZEN-1002');
      expect((unknownErr.details as any).path).toBe('loginEndpoint');

      const prevDev = (globalThis as any).__ZENITH_DEV__;
      const warnings: string[] = [];
      setSchemaWarnReporter((msg) => warnings.push(msg));
      try {
        (globalThis as any).__ZENITH_DEV__ = false;
        authConfigOptions.resolve({ loginUrl: '/api/login', typoKey: true });
        expect(warnings.some((w) => w.includes('ZEN-1002') && w.includes('typoKey'))).toBe(true);
      } finally {
        (globalThis as any).__ZENITH_DEV__ = prevDev;
        setSchemaWarnReporter(undefined);
      }
    });
  });

  describe('FunctionalAuthConfig (configureAuth / resolveFunctionalAuthConfig)', () => {
    it('exports frozen FUNCTIONAL_AUTH_CONFIG_DEFAULTS and merges partial endpoints', () => {
      expect(Object.isFrozen(FUNCTIONAL_AUTH_CONFIG_DEFAULTS)).toBe(true);
      expect(Object.isFrozen(FUNCTIONAL_AUTH_CONFIG_DEFAULTS.endpoints)).toBe(true);

      const resolved = resolveFunctionalAuthConfig();
      expect(resolved.storageKey).toBe('zenith_auth_tokens');
      expect(resolved.endpoints.login).toBe('/api/auth/login');

      configureAuth({ endpoints: { login: '/v2/login' }, autoRefresh: false });
      const cfg = getAuthConfig();
      expect(cfg.endpoints?.login).toBe('/v2/login');
      expect(cfg.endpoints?.me).toBe('/api/auth/me');
      expect(cfg.autoRefresh).toBe(false);
    });

    it('rejects invalid types, empty strings, and unknown keys on configureAuth', () => {
      const typeErr = catchError(() => configureAuth({ autoRefresh: 'yes' as any }));
      expect(typeErr.code).toBe('ZEN-1001');
      expect((typeErr.details as any).path).toBe('autoRefresh');

      const nestedErr = catchError(() => configureAuth({ endpoints: { login: '' } }));
      expect(nestedErr.code).toBe('ZEN-1004');
      expect((nestedErr.details as any).path).toBe('endpoints.login');

      const unknownNested = catchError(() => configureAuth({ endpoints: { signIn: '/x' } as any }));
      expect(unknownNested.code).toBe('ZEN-1002');
      expect((unknownNested.details as any).path).toBe('endpoints.signIn');

      const unknownTop = catchError(() =>
        functionalAuthConfigOptions.resolve({ unknownProp: 123 }),
      );
      expect(unknownTop.code).toBe('ZEN-1002');
      expect((unknownTop.details as any).path).toBe('unknownProp');
    });
  });
});
