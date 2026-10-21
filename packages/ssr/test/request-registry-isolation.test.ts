import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { clearScheduler, Priority } from '@zenith/scheduler';
import {
  clearRegistry, getAllSignals, getCurrentPriority, getStateTimeline, onStateChange,
  registerSignal, setCurrentPriority, signal,
} from '@zenith/state';
import { renderToString, renderToStream } from '../src';
import { getDOMGlobals, bindSSRCallback } from '../src/dom-context';

afterEach(() => { clearScheduler(); clearRegistry(); setCurrentPriority(Priority.normal); vi.unstubAllGlobals(); });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}

it('keeps 100 real render registries, request routes and default priorities out of the module registry', async () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  clearRegistry(); const outside = signal('outside-scope'), outsideId = registerSignal(outside);
  const originalPriority = setCurrentPriority('high');
  const retained: Array<ReturnType<typeof getDOMGlobals>> = [];
  const inspectRetired: Array<() => unknown[]> = [];
  try {
    const results = await Promise.all(Array.from({ length: 100 }, (_, id) => renderToString('<main>isolated</main>', {}, {
      route: `/registry-${id}`, locale: `locale-${id}`,
      app: async () => {
        expect(getCurrentPriority()).toBe(Priority.normal); setCurrentPriority(id % 2 ? 'idle' : 'urgent');
        const privateSignal = signal(`secret-${id}`); registerSignal(privateSignal, `private-${id}`);
        retained[id] = getDOMGlobals();
        inspectRetired[id] = bindSSRCallback(() => getAllSignals().map(info => info.value));
        await Promise.resolve();
        const entries = getAllSignals();
        expect(entries.some(info => info.value === 'outside-scope')).toBe(false);
        expect(entries.filter(info => typeof info.value === 'string' && info.value.startsWith('secret-')).map(info => info.value)).toEqual([`secret-${id}`]);
        expect(entries.some(info => info.id === outsideId)).toBe(false);
        expect(getCurrentPriority()).toBe(id % 2 ? Priority.idle : Priority.urgent);
        privateSignal.set(`updated-${id}`); expect(getStateTimeline().some(change => change.newValue === `updated-${id}`)).toBe(true);
        return createApp();
      },
    })));
    expect(results).toHaveLength(100);
    expect(getAllSignals().map(info => info.value)).toEqual(['outside-scope']);
    expect(getStateTimeline()).toEqual([]); expect(getCurrentPriority()).toBe(Priority.high);
    expect(retained).toHaveLength(100);
    // The native contexts can be retained by callers; their diagnostic payloads
    // must still be retired, rather than merely waiting for context GC.
    for (const store of retained) expect(store?.effectContext?.owner?.disposed).toBe(true);
    for (const inspect of inspectRetired) expect(inspect()).toEqual([]);
  } finally { outside.dispose(); setCurrentPriority(originalPriority); }
});

it('records writes in their registered native scope even when another request performs the write', async () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const entered = deferred<void>(), release = deferred<void>();
  let source: ReturnType<typeof signal<number>> | undefined;
  const events: Array<{ locale: string | undefined; value: unknown }> = [];
  const owner = renderToString('<main>owner</main>', {}, { route: '/registry-owner', locale: 'owner', app: async () => {
    source = signal(0); onStateChange(change => events.push({ locale: getDOMGlobals()?.locale, value: change.newValue }));
    entered.resolve(); await release.promise; return createApp();
  } });
  try {
    await Promise.race([entered.promise, owner.then(
      () => { throw new Error('owner render completed before registration'); }, error => { throw error; },
    )]);
    await renderToString('<main>writer</main>', {}, { route: '/registry-writer', locale: 'writer', app: () => {
      if (!source) throw new Error('source was not initialized'); source.set(42);
      expect(getStateTimeline().some(change => change.newValue === 42)).toBe(false); return createApp();
    } });
    expect(events.some(event => event.locale === 'owner' && event.value === 42)).toBe(true);
  } finally { release.resolve(); await owner; source?.dispose(); }
});

it('retains a live registry during stream backpressure, then closes it for late native continuations', async () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const resume = deferred<void>(), late = deferred<void>();
  let valuesAfterClose: unknown[] | undefined; let lateRegistration: number | undefined;
  let inspect: (() => unknown[]) | undefined;
  const stream = renderToStream('<main>registry-stream</main>', {}, { app: () => {
    const source = signal('stream-private'); registerSignal(source);
    inspect = bindSSRCallback(() => getAllSignals().map(info => info.value));
    void (async () => {
      await resume.promise;
      valuesAfterClose = getAllSignals().map(info => info.value);
      lateRegistration = registerSignal(source);
      source.dispose(); late.resolve();
    })();
    return createApp();
  } });
  try {
    const first = await stream.next(); expect(first.done).toBe(false); expect(inspect).toBeTypeOf('function');
    expect(getAllSignals().some(info => info.value === 'stream-private')).toBe(false);
    expect(inspect?.()).toContain('stream-private');
    await stream.return(undefined); expect(inspect?.()).toEqual([]); resume.resolve(); await late.promise;
    expect(valuesAfterClose).toEqual([]); expect(lateRegistration).toBe(-1);
  } finally { resume.resolve(); await stream.return(undefined); }
});

it('does not lend prepass/route/factory secrets to an installed realm-global Devtools observer', async () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const core = await import('@zenith/devtools-core');
  const installed = core.installDevtoolsCore({ enabled: true });
  const outside = signal('outside-modern'); const outsideId = core.registerSignal(outside);
  const before = core.getAllSignals().map(info => info.id);
  let prepassRuns = 0, optionReads = 0;
  const captures: unknown[] = []; const stopCapture = core.hook.on('signal:create', info => { captures.push(info.value); });
  try {
    const rendered = await renderToString('<main><zen-server-component name="private"></zen-server-component></main>', {}, {
      route: '/private-prepass',
      serverComponents: { private: () => {
        prepassRuns++;
        core.installDevtoolsCore({ get enabled() { optionReads++; return false; } }).dispose();
        const source = signal('prepass-secret');
        expect(core.registerSignal(source)).toBe(''); expect(core.getAllSignals()).toEqual([]);
        // An attempted request-local installation cannot disable the live
        // outside diagnostic configuration or publish a new global observer.
        core.installDevtoolsCore({ enabled: false }).dispose(); return '<p>private</p>';
      } },
      app: () => { const source = signal('factory-secret'); expect(core.registerSignal(source)).toBe(''); return createApp(); },
    });
    expect(prepassRuns).toBe(1); expect(optionReads).toBe(0); expect(rendered.html).toContain('<p>private</p>'); expect(captures).toEqual([]);
    expect(core.getAllSignals().map(info => info.id)).toEqual(before);
    expect(core.getSignalInfo(outsideId)?.signalRef.deref()).toBe(outside);
    const after = signal('still enabled');
    try { expect(core.getAllSignals().some(info => info.signalRef.deref() === after)).toBe(true); }
    finally { after.dispose(); }
  } finally { stopCapture(); installed.dispose(); outside.dispose(); core.clearDevtoolsRegistryInternal(); }
});

it('does not retain request-local Core listeners, hook handlers or panel payloads in realm registries', async () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const core = await import('@zenith/devtools-core');
  const installed = core.installDevtoolsCore({ enabled: true });
  const source = signal(0), actual = { outside: true };
  const panelCleanups = [core.registerApp('same', actual), core.registerDevtoolsStore('same', actual), core.registerDevtoolsCache('same', actual)];
  let retainedCallbacks = 0, outsideHookEvents = 0;
  const hookCleanup = core.hook.on('custom:ssr-policy', () => { outsideHookEvents++; });
  const rejectedCleanups: Array<() => void> = [];
  try {
    await renderToString('<main>private diagnostic subscribers</main>', {}, { app: () => {
      const privatePayload = { private: 'request only' };
      rejectedCleanups.push(core.onStateChange(() => { retainedCallbacks += privatePayload.private.length; }));
      rejectedCleanups.push(core.hook.on('custom:ssr-policy', () => { retainedCallbacks += privatePayload.private.length; }));
      rejectedCleanups.push(core.registerApp('same', privatePayload), core.registerDevtoolsCache('same', privatePayload), core.registerDevtoolsStore('same', privatePayload));
      core.hook.emit('custom:ssr-policy', privatePayload);
      expect(core.getRegisteredApps().size).toBe(0); expect(core.getRegisteredCaches().size).toBe(0); expect(core.getRegisteredStores().size).toBe(0);
      return createApp();
    } });
    expect(outsideHookEvents).toBe(0);
    source.set(1); core.hook.emit('custom:ssr-policy', { outside: true });
    expect(outsideHookEvents).toBe(1); expect(retainedCallbacks).toBe(0);
    expect(core.getRegisteredApps().get('same')).toBe(actual);
    expect(core.getRegisteredCaches().get('same')).toBe(actual);
    expect(core.getRegisteredStores().get('same')).toBe(actual);
  } finally {
    for (const cleanup of rejectedCleanups) cleanup(); hookCleanup();
    for (const cleanup of panelCleanups) cleanup();
    source.dispose(); installed.dispose(); core.clearDevtoolsRegistryInternal();
  }
});

it('cannot snapshot or time-travel outside Core data from a request scope', async () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const core = await import('@zenith/devtools-core'), installed = core.installDevtoolsCore({ enabled: true });
  const source = signal(1); const before = core.snapshot(); source.set(2);
  try {
    await renderToString('<main>no global time travel</main>', {}, { app: async () => {
      expect(core.snapshot().signals).toEqual({}); core.restore(before); await core.replay(0, 0, { speed: 200 });
      expect(source.get()).toBe(2); return createApp();
    } });
    expect(source.get()).toBe(2);
  } finally { source.dispose(); installed.dispose(); core.clearDevtoolsRegistryInternal(); }
});

it('keeps the global graph and compatibility panel out of 100 real prepass/factory scopes', async () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const core = await import('@zenith/devtools-core'), panel = await import('@zenith/devtools');
  const outside = { actual: 'outside' }; core.runtimeGraph.addSignal('outside-graph', { value: outside });
  core.runtimeGraph.addEffect('outside-effect');
  panel.devtoolsAPI.enable(); panel.registerPanelSignal({ get: () => outside }, 'outside');
  const before = core.getRuntimeGraph().nodes; let retained = 0, prepassRuns = 0;
  const stops: Array<() => void> = [];
  try {
    const results = await Promise.all(Array.from({ length: 100 }, (_, index) => renderToString('<main><zen-server-component name="privacy"></zen-server-component></main>', {}, {
      route: `/diagnostic-privacy-${index}`,
      serverComponents: { privacy: () => {
        prepassRuns++;
        core.runtimeGraph.addSignal(`secret-${index}`, { value: `prepass-${index}` });
        expect(core.getRuntimeGraph().nodes).toEqual([]); return `<p>private-${index}</p>`;
      } },
      app: () => {
        const local = new core.RuntimeGraph(); local.addSignal('local', { value: index }); expect(local.getGraph().nodes).toHaveLength(1);
        core.runtimeGraph.clear(); core.recordRead('outside-graph', 'outside-effect');
        panel.devtoolsAPI.disable(); panel.registerPanelSignal({ get: () => `factory-${index}` });
        stops.push(panel.devtoolsAPI.subscribeToSignals(() => { retained++; }));
        expect(panel.devtoolsAPI.getSignals()).toEqual([]); expect(panel.devtoolsAPI.getEffects()).toEqual([]);
        return createApp();
      },
    })));
    expect(prepassRuns).toBe(100); results.forEach((result, index) => expect(result.html).toContain(`<p>private-${index}</p>`));
    expect(core.getRuntimeGraph().nodes).toEqual(before); expect(core.getRuntimeGraph().edges).toEqual([]);
    expect(panel.devtoolsAPI.enabled).toBe(true); expect(panel.devtoolsAPI.getSignals().map(info => info.value)).toEqual([outside]);
    panel.registerPanelSignal({ get: () => 'outside-after' }); expect(retained).toBe(0);
  } finally { for (const stop of stops) stop(); panel.devtoolsAPI.disable(); core.clearDevtoolsRegistryInternal(); }
});
