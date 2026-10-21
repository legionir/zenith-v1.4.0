// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { signal } from '../../packages/state/src/index.ts';
import {
  useFakeTimers,
  mockHttp,
  mockRouter,
  testDirective,
  registerTestingReset,
  resetForTesting,
} from '../../packages/testing/src/index.ts';
import {
  compileTemplate,
  COMPILABLE_DIRECTIVES,
  RUNTIME_DIRECTIVES,
  runAllParityTests,
  generateParityReport,
} from '../../packages/compiler/src/index.ts';
import {
  createAuth,
  registerAuth,
  hasAuth,
  listAuths,
  unregisterAuth,
  clearAuth,
} from '../../packages/auth/src/index.ts';

describe('Wave 4 P1 Batch 10 — Testing Ergonomics, Compiler Parity, Unified Auth, .d.ts/JS Parity (#137..#140)', () => {
  it('provides useFakeTimers, mockHttp, mockRouter, testDirective, and resetForTesting in @zenith/testing (#137)', async () => {
    // 1. resetForTesting isolates global state between sequential tests
    let globalCounter = 0;
    const unreg = registerTestingReset(() => {
      globalCounter = 0;
    });
    globalCounter = 42;
    resetForTesting();
    expect(globalCounter).toBe(0);
    unreg();

    // 2. useFakeTimers integrated with scheduler
    const timers = useFakeTimers();
    const fired = signal(false);
    setTimeout(() => {
      fired.set(true);
    }, 500);
    expect(fired.get()).toBe(false);
    timers.advanceTimersByTime(500);
    expect(fired.get()).toBe(true);
    timers.restore();

    // 3. mockHttp intercepts fetch without real network
    const httpMock = mockHttp((url) => ({
      status: 200,
      data: { echoedUrl: url },
    }));
    const resp = await fetch('/api/hello');
    const json = await resp.json();
    expect(json.echoedUrl).toBe('/api/hello');
    expect(httpMock.calls.length).toBe(1);
    httpMock.restore();

    // 4. mockRouter tracks in-memory route state and history
    const router = mockRouter('/home');
    router.navigate('/profile');
    expect(router.currentPath.get()).toBe('/profile');
    expect(router.history).toEqual(['/home', '/profile']);
    router.reset();
    expect(router.currentPath.get()).toBe('/home');

    // 5. testDirective mounts and binds a directive in isolation
    const greeting = signal('سلام دنیا');
    const harness = testDirective(
      {
        name: 'custom-upper',
        bind(el, ctx) {
          el.textContent = String(ctx.eval());
        },
      },
      '<span zen-custom-upper="$greeting"></span>',
      { greeting },
    );
    expect(harness.el.textContent).toBe('سلام دنیا');
    harness.dispose();
  });

  it('registers all 6 runtime-only directives in RUNTIME_DIRECTIVES and passes compiler parity report (#138)', async () => {
    const sixRuntimeOnly = [
      'zen-resource-view',
      'zen-action-button',
      'zen-auth-view',
      'zen-router',
      'zen-button',
      'zen-if-chain',
    ];
    for (const dir of sixRuntimeOnly) {
      expect(RUNTIME_DIRECTIVES.has(dir)).toBe(true);
    }
    expect(COMPILABLE_DIRECTIVES.has('zen-text')).toBe(true);

    const compiled = await compileTemplate(
      '<div zen-router="main"><button zen-action-button="save">Save</button></div>',
    );
    expect(compiled.runtimeDirectives.some((d) => d.directive === 'zen-router')).toBe(true);
    expect(compiled.runtimeDirectives.some((d) => d.directive === 'zen-action-button')).toBe(true);

    const reportData = runAllParityTests(
      (ctx) => ctx.html,
      (ctx) => ctx.html,
    );
    expect(reportData.failed).toBe(0);
    const report = generateParityReport(reportData);
    expect(report).toContain('PARITY REPORT');

    const parityDoc = path.resolve(process.cwd(), 'docs', 'DIRECTIVE-PARITY.md');
    expect(fs.existsSync(parityDoc)).toBe(true);
  });

  it('supports Auth 5-method registry, cross-tab logout sync, and MFA verification (#139)', async () => {
    clearAuth();
    const authInstance = createAuth({ loginUrl: '/api/login' });
    const stopReg = registerAuth('main', authInstance);
    expect(hasAuth('main')).toBe(true);
    expect(listAuths()).toContain('main');

    const stopSync = authInstance.enableCrossTabSync();
    const httpMock = mockHttp(() => ({
      status: 200,
      data: { token: 'mfa-jwt-token', user: { id: 1, name: 'Ali' } },
    }));

    const verified = await authInstance.verifyMfa('123456');
    expect(verified).toBe(true);
    expect(authInstance.isAuthenticated).toBe(true);

    httpMock.restore();
    stopSync();
    stopReg();
    expect(hasAuth('main')).toBe(false);

    registerAuth('temp', authInstance);
    expect(unregisterAuth('temp')).toBe(true);
  });
});
