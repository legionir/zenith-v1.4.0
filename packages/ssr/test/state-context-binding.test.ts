import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, expect, it } from 'vitest';
import { clearScheduler, flushSync } from '@zenith/scheduler';
import { createAsync, createRoot, computed, effect, getOwner, onCleanup, setOwner, signal, watch, type WatchCleanupRegistrar } from '@zenith/state';
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';
import { routeSignal } from '@zenith/router';
import { runWithRoute, runWithRouteSync } from '@zenith/router/node';
import { bindSSRCallback, domAls, getDOMGlobals, type DOMGlobals } from '../src/dom-context';

const hostContext = (): EffectContext => ({
  owner: null, activeEffect: null, activeCleanupRegistration: null, bind: bindSSRCallback,
});
afterEach(() => { clearScheduler(); setEffectContextStore(null); setOwner(null); });

it('binds queued state work and late teardown to each of 100 live DOM/route/native scopes', async () => {
  const appContext = new AsyncLocalStorage<number>();
  const rows: Array<{ index: number; route: string; locale: string | undefined; app: number | undefined; value: number }> = [];
  const cleanups: Array<{ index: number; route: string; locale: string | undefined; app: number | undefined; owned: boolean }> = [];
  setEffectContextStore(() => getDOMGlobals()?.effectContext ?? null);
  const createRequest = (index: number, store: DOMGlobals) => createRoot(dispose => {
    const owner = getOwner(); const source = signal(index);
    const derived = computed(() => source.get() * 2);
    effect(() => rows.push({
      index, route: routeSignal.get().path, locale: getDOMGlobals()?.locale,
      app: appContext.getStore(), value: derived.get(),
    }));
    onCleanup(() => cleanups.push({
      index, route: routeSignal.peek().path, locale: getDOMGlobals()?.locale,
      app: appContext.getStore(), owned: getOwner() === owner,
    }));
    return { source, derived, dispose, store };
  });
  const requests: Array<ReturnType<typeof createRequest>> = [];
  let release!: () => void, markStarted!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  const pending = Array.from({ length: 100 }, (_, index) => runWithRoute(`/request-${index}`, async () => {
    const store: DOMGlobals = { locale: `locale-${index}`, effectContext: hostContext() };
    return domAls.run(store, () => appContext.run(index, async () => {
      const request = createRequest(index, store); requests[index] = request;
      if (requests.filter(Boolean).length === 100) markStarted();
      try { await hold; } finally { request.dispose(); }
    }));
  }));
  try {
    // Do not retain a finished sync route scope: all request leases remain live.
    await Promise.race([started, Promise.all(pending)]);
    const caller: DOMGlobals = { locale: 'caller', effectContext: hostContext() };
    runWithRouteSync('/caller', () => domAls.run(caller, () => appContext.run(-1, () => createRoot(dispose => {
      const owner = getOwner();
      try {
        for (const request of requests) request.source.set(request.source.peek() + 1);
        flushSync();
        expect(getOwner()).toBe(owner); expect(getDOMGlobals()).toBe(caller);
        expect(routeSignal.peek().path).toBe('/caller'); expect(appContext.getStore()).toBe(-1);
        for (const request of requests) { request.dispose(); request.dispose(); }
        expect(getOwner()).toBe(owner); expect(getDOMGlobals()).toBe(caller);
        expect(routeSignal.peek().path).toBe('/caller'); expect(appContext.getStore()).toBe(-1);
        for (const request of requests) request.source.set(999);
        flushSync(); expect(rows).toHaveLength(200);
      } finally { for (const request of requests) request.dispose(); dispose(); }
    }))));
    for (let index = 0; index < requests.length; index++) {
      expect(rows.filter(row => row.index === index)).toEqual([
        { index, route: `/request-${index}`, locale: `locale-${index}`, app: index, value: index * 2 },
        { index, route: `/request-${index}`, locale: `locale-${index}`, app: index, value: (index + 1) * 2 },
      ]);
      expect(cleanups.filter(row => row.index === index)).toEqual([
        { index, route: `/request-${index}`, locale: `locale-${index}`, app: index, owned: true },
      ]);
      expect(requests[index]?.source.subscriberCount).toBe(0);
      expect(requests[index]?.derived.subscriberCount).toBe(0);
      expect(requests[index]?.store.effectContext?.owner).toBeNull();
    }
    expect(getOwner()).toBeNull(); expect(getDOMGlobals()).toBeUndefined();
  } finally { release(); await Promise.all(pending); }
});

it('captures a fresh native snapshot for each registration, not the first App using a request', () => {
  const appContext = new AsyncLocalStorage<string>();
  const store: DOMGlobals = { effectContext: hostContext() };
  const seen: Array<string | undefined> = [];
  setEffectContextStore(() => getDOMGlobals()?.effectContext ?? null);
  domAls.run(store, () => createRoot(dispose => {
    const source = signal(0);
    appContext.run('first', () => effect(() => { source.get(); seen.push(appContext.getStore()); }));
    appContext.run('second', () => effect(() => { source.get(); seen.push(appContext.getStore()); }));
    try {
      appContext.run('caller', () => { source.set(1); flushSync(); expect(appContext.getStore()).toBe('caller'); });
      expect(seen).toEqual(['first', 'second', 'first', 'second']);
    } finally { dispose(); }
  }));
});

it('preserves actual generic results and exceptions through the native binder', () => {
  const storage = new AsyncLocalStorage<string>(); const value = { id: Symbol('value') };
  const bound = storage.run('origin', () => bindSSRCallback(() => ({ value, context: storage.getStore() })));
  storage.run('caller', () => {
    expect(bound()).toEqual({ value, context: 'origin' }); expect(bound().value).toBe(value);
    expect(storage.getStore()).toBe('caller');
  });
  const fail = storage.run('origin', () => bindSSRCallback(() => { throw value; }));
  try { fail(); throw new Error('expected callback failure'); } catch (error) { expect(error).toBe(value); }
  expect(storage.getStore()).toBeUndefined();
});


it('keeps explicit async refresh, abort listeners and lazy computation in their creation scopes', async () => {
  const storage = new AsyncLocalStorage<string>();
  const store: DOMGlobals = { effectContext: hostContext() };
  const reads: Array<string | undefined> = [], aborts: Array<string | undefined> = [];
  setEffectContextStore(() => getDOMGlobals()?.effectContext ?? null);
  const owned = domAls.run(store, () => storage.run('producer', () => createRoot(dispose => {
    const derived = computed(() => storage.getStore());
    const asyncValue = createAsync(async ({ signal: abortSignal }) => {
      reads.push(storage.getStore());
      abortSignal.addEventListener('abort', () => aborts.push(storage.getStore()), { once: true });
      await Promise.resolve(); reads.push(storage.getStore()); return storage.getStore();
    }, { immediate: false });
    return { derived, asyncValue, dispose };
  })));
  try {
    await storage.run('caller', async () => {
      expect(owned.derived.get()).toBe('producer'); expect(storage.getStore()).toBe('caller');
      expect(await owned.asyncValue.refresh()).toBe('producer');
      expect(storage.getStore()).toBe('caller');
      const pending = owned.asyncValue.refresh(); owned.asyncValue.abort(); await pending;
      expect(storage.getStore()).toBe('caller');
    });
    expect(reads).toEqual(['producer', 'producer', 'producer', 'producer']);
    expect(aborts).toEqual(['producer']);
  } finally { owned.dispose(); }
});

it('runs watch stop and late cleanup registration in the watch creation scope', () => {
  const storage = new AsyncLocalStorage<string>();
  const store: DOMGlobals = { effectContext: hostContext() };
  const seen: Array<string | undefined> = [];
  let register: WatchCleanupRegistrar | undefined;
  setEffectContextStore(() => getDOMGlobals()?.effectContext ?? null);
  const owned = domAls.run(store, () => storage.run('watch-owner', () => createRoot(dispose => {
    const stop = watch(signal(0), (_value, _previous, onWatchCleanup) => {
      register = onWatchCleanup;
      onWatchCleanup(() => seen.push(storage.getStore()));
    }, { immediate: true });
    return { stop, dispose };
  })));
  try {
    storage.run('caller', () => {
      owned.stop(); owned.stop();
      if (!register) throw new Error('watch callback did not expose its cleanup protocol');
      register(() => seen.push(storage.getStore()));
      expect(storage.getStore()).toBe('caller');
    });
    expect(seen).toEqual(['watch-owner', 'watch-owner']);
  } finally { owned.dispose(); }
});

it('preserves ordered native callback operands without erasing their return type', () => {
  const storage = new AsyncLocalStorage<string>();
  const bound = storage.run('creator', () => bindSSRCallback((name: string, count: number) => ({
    name, count, context: storage.getStore(),
  })));
  storage.run('caller', () => {
    expect(bound('entry', 42)).toEqual({ name: 'entry', count: 42, context: 'creator' });
    expect(storage.getStore()).toBe('caller');
  });
});

it('honors a nested native host scope inside an active effect without corrupting the outer tracking context', () => {
  const left: DOMGlobals = { locale: 'left', effectContext: hostContext() };
  const right: DOMGlobals = { locale: 'right', effectContext: hostContext() };
  setEffectContextStore(() => getDOMGlobals()?.effectContext ?? null);
  let stopRight: (() => void) | undefined;
  const leftSource = signal(0), rightSource = signal(0); const reads: string[] = [];
  const stopLeft = domAls.run(left, () => effect(() => {
    leftSource.get(); reads.push(`left-${getDOMGlobals()?.locale}`);
    // The nested provider is a deliberate host context switch, not a stale
    // provider read during dispatch of the outer request's queued callback.
    if (!stopRight) stopRight = domAls.run(right, () => effect(() => {
      rightSource.get(); reads.push(`right-${getDOMGlobals()?.locale}`);
    }, { owner: null }));
    expect(getDOMGlobals()).toBe(left);
  }, { owner: null }));
  try {
    expect(leftSource.subscriberCount).toBe(1); expect(rightSource.subscriberCount).toBe(1);
    rightSource.set(1); flushSync(); expect(reads).toEqual(['left-left', 'right-right', 'right-right']);
    expect(left.effectContext?.activeEffect).toBeNull(); expect(right.effectContext?.activeEffect).toBeNull();
  } finally { stopLeft(); stopRight?.(); leftSource.dispose(); rightSource.dispose(); }
});
