// #147 — تست‌های جامع @zenith/devtools-core (SPEC §۲.۷):
//   • اتصال به setSignalObserver در @zenith/state و پاک‌سازی با dispose()
//   • رجیستری واحد با ID رشته‌ای (`sig-N`)، nameSignal، getAllSignals، getSignalInfo
//   • Timeline، onStateChange، redact، sampleRate، captureValues
//   • Time-travel: snapshot(), restore(snap), replay(from, to, { speed })
//   • خطاهای ZEN-2401 (نسخهٔ hook ناسازگار) و ZEN-2402 (snapshot نامعتبر)
//   • RuntimeGraph و رجیستری پنل (registerCache/registerStore/registerApp)
//   • هشدار deprecation یک‌باره روی بازصادرات میراث در @zenith/state

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  signal,
  setSignalObserver,
  getSignalObserver,
  registerSignal as legacyStateRegisterSignal,
} from '@zenith/state';
import { ZenithError } from '@zenith/errors';
import type { Disposable } from '@zenith/shared';
import {
  installDevtoolsCore,
  DEVTOOLS_CORE_DEFAULTS,
  resolveDevtoolsCoreOptions,
  registerSignal,
  nameSignal,
  getAllSignals,
  getSignalInfo,
  getTimeline,
  onStateChange,
  clearRegistry,
  snapshot,
  restore,
  replay,
  RuntimeGraph,
  registerCache,
  registerStore,
  registerApp,
  getRegisteredCaches,
  getRegisteredStores,
  getRegisteredApps,
  hook,
  DEVTOOLS_HOOK_VERSION,
  assertHookVersion,
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

describe('@zenith/devtools-core (#147, SPEC §2.7)', () => {
  let core: Disposable | null = null;

  beforeEach(() => {
    clearRegistry();
    delete (globalThis as any).__ZENITH_DEVTOOLS_HOOK__;
    delete (globalThis as any).__ZENITH_SSR__;
  });

  afterEach(() => {
    core?.dispose();
    core = null;
    clearRegistry();
    delete (globalThis as any).__ZENITH_DEVTOOLS_HOOK__;
    delete (globalThis as any).__ZENITH_SSR__;
  });

  it('exports frozen DEVTOOLS_CORE_DEFAULTS and validates DevtoolsCoreOptions', () => {
    expect(Object.isFrozen(DEVTOOLS_CORE_DEFAULTS)).toBe(true);
    expect(resolveDevtoolsCoreOptions().maxTimelineEntries).toBe(1000);

    const rangeErr = catchError(() => resolveDevtoolsCoreOptions({ sampleRate: 2 }));
    expect(rangeErr.code).toBe('ZEN-1004');

    const unknownErr = catchError(() => resolveDevtoolsCoreOptions({ unknownFlag: true }));
    expect(unknownErr.code).toBe('ZEN-1002');
  });

  it('connects to @zenith/state via setSignalObserver and tracks signal lifecycle with string IDs', () => {
    expect(getSignalObserver()).toBeNull();
    core = installDevtoolsCore();
    expect(getSignalObserver()).not.toBeNull();
    expect((globalThis as any).__ZENITH_DEVTOOLS_HOOK__).toBe(hook);

    const count = signal(10);
    const all = getAllSignals();
    expect(all.length).toBe(1);
    const id = all[0]!.id;
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^sig-\d+$/);
    expect(registerSignal(count)).toBe(id);

    nameSignal(count, 'counter');
    expect(getSignalInfo(id)?.name).toBe('counter');

    const seen: any[] = [];
    const off = onStateChange((chg) => seen.push(chg));

    count.set(20);
    count.update((n) => n + 5);

    const tl = getTimeline();
    expect(tl.length).toBe(2);
    expect(tl[0]!.signalId).toBe(id);
    expect(tl[0]!.signalName).toBe('counter');
    expect(tl[0]!.oldValue).toBe(10);
    expect(tl[0]!.newValue).toBe(20);
    expect(tl[1]!.oldValue).toBe(20);
    expect(tl[1]!.newValue).toBe(25);
    expect(seen.length).toBe(2);

    off();
    count.set(30);
    expect(seen.length).toBe(2);

    // Explicit signal disposal removes it from active registry
    count.dispose();
    expect(getSignalInfo(id)).toBeUndefined();

    // Disposing core detaches SignalObserver and cleans global hook
    core.dispose();
    expect(getSignalObserver()).toBeNull();
    expect((globalThis as any).__ZENITH_DEVTOOLS_HOOK__).toBeUndefined();
  });

  it('redacts sensitive object keys and supports captureValues: false', () => {
    core = installDevtoolsCore({ captureValues: true });
    const authSig = signal({ user: 'ali', token: 'secret-jwt', password: '123' });
    const id = registerSignal(authSig, 'auth');
    expect(getSignalInfo(id)?.value).toEqual({
      user: 'ali',
      token: '[REDACTED]',
      password: '[REDACTED]',
    });

    core.dispose();
    clearRegistry();

    core = installDevtoolsCore({ captureValues: false });
    const listSig = signal([1, 2, 3]);
    const listId = registerSignal(listSig, 'items');
    expect(getSignalInfo(listId)?.value).toBe('[Array(3)]');
  });

  it('supports time-travel: snapshot(), restore(snap), and replay(from, to)', async () => {
    core = installDevtoolsCore();
    const a = signal(1);
    const b = signal('initial');
    nameSignal(a, 'a');
    nameSignal(b, 'b');

    const snap0 = snapshot();
    expect(snap0.version).toBe(DEVTOOLS_HOOK_VERSION);

    a.set(2);
    a.set(3);
    b.set('updated');

    expect(a.get()).toBe(3);
    expect(b.get()).toBe('updated');

    // Restore back to snap0
    restore(snap0);
    expect(a.get()).toBe(1);
    expect(b.get()).toBe('initial');

    // Replay timeline forward (indices 0..2)
    await replay(0, 2, { speed: 200 });
    expect(a.get()).toBe(3);
    expect(b.get()).toBe('updated');

    // Replay timeline backward (indices 2..0)
    await replay(2, 0, { speed: 200 });
    expect(a.get()).toBe(1);
    expect(b.get()).toBe('initial');
  });

  it('throws ZEN-2401 on incompatible hook/snapshot version and ZEN-2402 on malformed snapshot', () => {
    const verErr = catchError(() => assertHookVersion('0.9.0'));
    expect(verErr.code).toBe('ZEN-2401');

    (globalThis as any).__ZENITH_DEVTOOLS_HOOK__ = { version: '9.9.9' };
    const installErr = catchError(() => installDevtoolsCore());
    expect(installErr.code).toBe('ZEN-2401');
    delete (globalThis as any).__ZENITH_DEVTOOLS_HOOK__;

    const badSnapErr = catchError(() => restore({ invalid: true }));
    expect(badSnapErr.code).toBe('ZEN-2402');

    const badEntryErr = catchError(() =>
      restore({
        version: DEVTOOLS_HOOK_VERSION,
        timestamp: Date.now(),
        signals: { 'sig-1': {} },
        timelineLength: 0,
      }),
    );
    expect(badEntryErr.code).toBe('ZEN-2402');

    const snapVerErr = catchError(() =>
      restore({
        version: '2.0.0',
        timestamp: Date.now(),
        signals: {},
        timelineLength: 0,
      }),
    );
    expect(snapVerErr.code).toBe('ZEN-2401');
  });

  it('provides RuntimeGraph and panel registries (registerCache, registerStore, registerApp)', () => {
    const g = new RuntimeGraph();
    g.addSignal('s1', 'count', 0);
    g.addEffect('e1', ['s1']);
    g.addDirective('d1', 'zen-text', '#out', 'count');
    g.addDom('dom1', 'SPAN');
    g.recordRead('s1', 'e1');
    g.recordWrite('e1', 'd1');
    g.recordDomUpdate('d1', 'dom1');

    const snap = g.getGraph();
    expect(snap.counts).toEqual({
      signals: 1,
      effects: 1,
      directives: 1,
      dom: 1,
      edges: 3,
    });

    const offCache = registerCache('http', { size: 1 });
    const offStore = registerStore('user', { id: 1 });
    const offApp = registerApp('main', { mounted: true });

    expect(getRegisteredCaches().has('http')).toBe(true);
    expect(getRegisteredStores().has('user')).toBe(true);
    expect(getRegisteredApps().has('main')).toBe(true);

    offCache();
    offStore();
    offApp();

    expect(getRegisteredCaches().has('http')).toBe(false);
    expect(getRegisteredStores().has('user')).toBe(false);
    expect(getRegisteredApps().has('main')).toBe(false);
  });

  it('is a safe no-op in SSR mode and emits deprecation warnings on legacy @zenith/state registry calls', () => {
    (globalThis as any).__ZENITH_SSR__ = true;
    core = installDevtoolsCore();
    expect(getSignalObserver()).toBeNull();
    delete (globalThis as any).__ZENITH_SSR__;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const s = signal(1);
      legacyStateRegisterSignal(s, 'legacy');
      expect(warnSpy.mock.calls.flat().join('\n')).toContain('ZEN-DEPR-027');
    } finally {
      warnSpy.mockRestore();
    }

    // setSignalObserver cleanup is idempotent
    const obs = { onCreate() {} };
    const cleanup = setSignalObserver(obs);
    expect(getSignalObserver()).toBe(obs);
    cleanup();
    cleanup();
    expect(getSignalObserver()).toBeNull();
  });
});
