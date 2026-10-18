import { afterEach, expect, it } from 'vitest';
import { clearScheduler, flushSync } from '@zenith/scheduler';
import { createApp, type App } from '@zenith/runtime-core';
import { computed, createAsync, effect, getOwner, onCleanup, signal, watch, type Owner } from '@zenith/state';
import { routeSignal } from '@zenith/router';
import { renderToString, renderToStream } from '../src';
import { getDOMGlobals } from '../src/dom-context';

afterEach(() => { clearScheduler(); });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}

it('owns prepass and async factory state in each of 100 real render request lifetimes', async () => {
  const source = signal(0), owners = new Set<Owner>();
  const cleaned: Array<{ index: number; route: string; locale: string | undefined; disposed: boolean }> = [];
  const runs = new Map<number, number>();
  try {
    const outputs = await Promise.all(Array.from({ length: 100 }, (_, index) => renderToString(
      '<main><zen-server-component name="owned"></zen-server-component></main>', {}, {
        route: `/owned-${index}`, locale: `locale-${index}`,
        serverComponents: { owned: async () => {
          const owner = getOwner(); if (!owner) throw new Error('missing request owner');
          owners.add(owner); await Promise.resolve(); expect(getOwner()).toBe(owner);
          effect(() => { source.get(); runs.set(index, (runs.get(index) ?? 0) + 1); });
          onCleanup(() => cleaned.push({ index, route: routeSignal.peek().path, locale: getDOMGlobals()?.locale, disposed: owner.disposed }));
          return `<p>request-${index}</p>`;
        } },
        app: async () => {
          const owner = getOwner(); if (!owner) throw new Error('missing factory owner');
          expect(owners.has(owner)).toBe(true);
          await Promise.resolve(); expect(getOwner()).toBe(owner);
          const derived = computed(() => source.get() + index);
          effect(() => derived.get()); watch(source, () => {}, { immediate: true });
          const pending = createAsync(async () => { source.get(); return index; });
          await pending.refresh(); return createApp();
        },
      },
    )));
    expect(owners.size).toBe(100); expect(source.subscriberCount).toBe(0);
    outputs.forEach((output, index) => expect(output.html).toContain(`request-${index}`));
    for (let index = 0; index < 100; index++) {
      expect(runs.get(index)).toBe(1);
      expect(cleaned.filter(item => item.index === index)).toEqual([
        { index, route: `/owned-${index}`, locale: `locale-${index}`, disposed: true },
      ]);
    }
    for (const owner of owners) { expect(owner.disposed).toBe(true); expect(owner.children.size).toBe(0); expect(owner.cleanup.size).toBe(0); }
    source.set(1); flushSync(); expect([...runs.values()].every(count => count === 1)).toBe(true);
    expect(getOwner()).toBeNull();
  } finally { source.dispose(); }
});

it('gives a render without a route its own default route rather than borrowing browser state', async () => {
  const previous = routeSignal.peek(); routeSignal.set({ path: '/browser-outside', params: {} });
  try {
    let requestRoute: string | undefined;
    await renderToString('<main></main>', {}, { app: () => { requestRoute = routeSignal.peek().path; return createApp(); } });
    expect(requestRoute).toBe('/'); expect(routeSignal.peek().path).toBe('/browser-outside');
  } finally { routeSignal.set(previous); }
});

it('disposes a request owner and its subscriptions when rendering fails', async () => {
  const source = signal(0); let owner: Owner | null = null, cleanups = 0;
  try {
    await expect(renderToString('<main>failure</main>', {}, {
      app: () => {
        owner = getOwner(); effect(() => source.get()); onCleanup(() => { cleanups++; });
        throw new Error('factory failure');
      },
    })).rejects.toThrow('factory failure');
    expect(cleanups).toBe(1); expect(owner).toMatchObject({ disposed: true }); expect(source.subscriberCount).toBe(0);
  } finally { source.dispose(); }
});

it('retires ambient state ownership before a cancelled factory resumes late', async () => {
  const entered = deferred<void>(), resume = deferred<void>(), resumed = deferred<void>();
  const controller = new AbortController(); const source = signal(0);
  let owner: Owner | null = null, runs = 0, lateOwner: Owner | null = null;
  let lateApp: App | undefined, factoryEntered = false;
  const pending = renderToString('<main>cancelled</main>', {}, {
    route: '/cancelled-owner', signal: controller.signal,
    app: async () => {
      factoryEntered = true;
      try {
        owner = getOwner(); effect(() => { source.get(); runs++; }); entered.resolve();
        await resume.promise;
        lateOwner = getOwner(); effect(() => { source.get(); runs++; });
        lateApp = createApp(); return lateApp;
      } finally { resumed.resolve(); }
    },
  });
  try {
    await Promise.race([entered.promise, pending.then(
      () => { throw new Error('render completed before entering its factory'); },
      error => { throw error; },
    )]);
    controller.abort(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(owner).toMatchObject({ disposed: true }); expect(source.subscriberCount).toBe(0);
    resume.resolve(); await resumed.promise; await Promise.resolve(); await Promise.resolve();
    expect(lateOwner).toBe(owner); expect(runs).toBe(1); expect(source.subscriberCount).toBe(0);
  } finally {
    controller.abort(); resume.resolve();
    if (factoryEntered) await resumed.promise;
    await pending.catch(() => {}); source.dispose(); lateApp?.dispose();
  }
});

it('keeps ambient state alive while a stream is paused and disposes it on iterator return', async () => {
  const source = signal(0); let owner: Owner | null = null, cleanups = 0;
  const stream = renderToStream('<main>stream-owned</main>', {}, { route: '/stream-owner', app: () => {
    owner = getOwner(); effect(() => source.get()); onCleanup(() => { cleanups++; }); return createApp();
  } });
  try {
    await stream.next(); expect(source.subscriberCount).toBe(1); expect(owner).toMatchObject({ disposed: false });
    await stream.return(undefined);
    expect(source.subscriberCount).toBe(0); expect(owner).toMatchObject({ disposed: true }); expect(cleanups).toBe(1);
  } finally { await stream.return(undefined); source.dispose(); }
});
