// #52 — اعتبارسنجی گزینه‌های @zenith/service-worker در مرز ورودی (SWConfig / RouteConfig / RegisterSWOptions / SWRuntimeConfig)
import { describe, it, expect } from 'vitest';
import { ZenithError } from '@zenith/errors';
import {
  registerSW,
  zenithSWPlugin,
  SW_CONFIG_DEFAULTS,
  ROUTE_CONFIG_DEFAULTS,
  REGISTER_SW_OPTIONS_DEFAULTS,
  resolveSWConfig,
  resolveRouteConfig,
  resolveRegisterSWOptions,
} from '../src/index';
import { setupSW, SW_RUNTIME_CONFIG_DEFAULTS, resolveSWRuntimeConfig } from '../src/sw';

function catchError(fn: () => unknown): ZenithError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ZenithError);
    return err as ZenithError;
  }
  throw new Error('Expected function to throw ZenithError');
}

describe('@zenith/service-worker options validation (#52)', () => {
  it('exports frozen DEFAULTS and resolves defaults for SWConfig, RegisterSWOptions, and SWRuntimeConfig', () => {
    expect(Object.isFrozen(SW_CONFIG_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(ROUTE_CONFIG_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(REGISTER_SW_OPTIONS_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(SW_RUNTIME_CONFIG_DEFAULTS)).toBe(true);

    expect(resolveSWConfig()).toEqual({
      swUrl: '/sw.js',
      scope: '/',
      routes: [],
      precache: [],
      defaultStrategy: 'networkOnly',
      skipWaiting: false,
      clientsClaim: false,
    });

    expect(
      resolveRouteConfig({ urlPattern: /^\/api\//, strategy: 'networkFirst', timeout: 2000 }),
    ).toEqual({
      urlPattern: /^\/api\//,
      strategy: 'networkFirst',
      timeout: 2000,
    });
  });

  it('rejects unknown strategy, negative timeout, and unknown keys on RouteConfig / SWConfig', () => {
    const strategyErr = catchError(() =>
      resolveRouteConfig({ urlPattern: '/api', strategy: 'fastestPossible' }),
    );
    expect(strategyErr.code).toBe('ZEN-1001');
    expect((strategyErr.details as any).path).toBe('strategy');
    expect((strategyErr.details as any).expected).toContain('enum');

    const timeoutErr = catchError(() =>
      resolveSWConfig({
        routes: [{ urlPattern: '/api', strategy: 'networkFirst', timeout: -50 }],
      }),
    );
    expect(timeoutErr.code).toBe('ZEN-1004');
    expect((timeoutErr.details as any).path).toBe('routes.0.timeout');

    const unknownKeyErr = catchError(() =>
      zenithSWPlugin.install({}, { swUrl: '/sw.js', unknownFlag: true }),
    );
    expect(unknownKeyErr.code).toBe('ZEN-1002');
    expect((unknownKeyErr.details as any).path).toBe('unknownFlag');
  });

  it('validates registerSW and setupSW at the entry boundary before environment guards', () => {
    const emptyUrlErr = catchError(() => registerSW(''));
    expect(emptyUrlErr.code).toBe('ZEN-1004');

    const badCallbackErr = catchError(() =>
      registerSW('/sw.js', { onUpdateFound: 'not-a-fn' as any }),
    );
    expect(badCallbackErr.code).toBe('ZEN-1001');
    expect((badCallbackErr.details as any).path).toBe('onUpdateFound');

    const badRuntimeErr = catchError(() =>
      setupSW({
        precache: [],
        routes: [{ urlPattern: '/api', strategy: 'invalidStrategy' as any }],
      }),
    );
    expect(badRuntimeErr.code).toBe('ZEN-1001');
    expect((badRuntimeErr.details as any).path).toBe('routes.0.strategy');

    expect(resolveRegisterSWOptions()).toEqual({ scope: '/' });
    expect(resolveSWRuntimeConfig().defaultCacheName).toBe('zenith-cache');
  });
});
