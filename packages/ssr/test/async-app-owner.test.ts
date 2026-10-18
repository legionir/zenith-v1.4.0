import { describe, expect, it, vi } from 'vitest';
import { createApp, type App } from '@zenith/runtime-core';
import { renderToString, renderToStream, createAsyncContextStore, clearSSRTemplateCache, getSSRTemplateCacheStats } from '../src';
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

describe('asynchronous SSR App ownership', () => {
  it('keeps 100 overlapping native contexts distinct across reversed completions', async () => {
    const context = createAsyncContextStore<{ id: number }>();
    const gates = Array.from({ length: 100 }, () => deferred<void>());
    const pending = gates.map((gate, id) => context.run({ id }, async () => { await gate.promise; await Promise.resolve(); expect(context.getStore()?.id).toBe(id); return id; }));
    [...gates].reverse().forEach(gate => gate.resolve());
    expect(await Promise.all(pending)).toHaveLength(100); expect(context.getStore()).toBeUndefined();
  });
  it('gives each async factory its own document, state, head and cancellation signal', async () => {
    const owners: ReturnType<typeof vi.fn>[] = [];
    const results = await Promise.all(Array.from({ length: 100 }, (_, id) => renderToString('<main><h1 zen-text="name"></h1></main>', { name: `async-${id}` }, {
      route: `/request-${id}`, app: async context => {
        const document = context.document;
        await Promise.resolve(); await Promise.resolve();
        expect(globalThis.document).toBe(document); expect(context.route).toBe(`/request-${id}`);
        expect(context.signal.aborted).toBe(false); expect(context.state.name).toBe(`async-${id}`);
        context.head.push({ title: `head-${id}` });
        const app = createApp(); owners.push(vi.spyOn(app, 'dispose')); return app;
      },
    })));
    results.forEach((result, id) => { expect(result.html).toContain(`async-${id}`); expect(result.headTags).toContain(`head-${id}`); });
    expect(owners).toHaveLength(100); owners.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });
  it('returns from abort without awaiting a factory, then disposes its late App without mounting', async () => {
    clearSSRTemplateCache();
    const entered = deferred<void>(), release = deferred<App>(), late = deferred<void>();
    const controller = new AbortController(); let document: Document | undefined;
    const pending = renderToString('<main>late factory</main>', {}, { signal: controller.signal, app: async context => {
      document = context.document; entered.resolve(); const app = await release.promise; late.resolve(); return app;
    } });
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await entered.promise; controller.abort(); await rejection;
    expect(getSSRTemplateCacheStats().pooledDOMInstances).toBe(0);
    const app = createApp(), mount = vi.spyOn(app, 'mount'), dispose = vi.spyOn(app, 'dispose');
    release.resolve(app); await late.promise; await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
    expect(mount).not.toHaveBeenCalled();
    let nextDocument: Document | undefined;
    await renderToString('<main>next request</main>', {}, { app: context => { nextDocument = context.document; return createApp(); } });
    expect(nextDocument).not.toBe(document); clearSSRTemplateCache();
  });
  it('aborts the factory context when the renderer itself reaches its deadline', async () => {
    const entered = deferred<AbortSignal>(), release = deferred<App>();
    const pending = renderToString('<main>timeout</main>', {}, { timeout: 1000, app: async context => { entered.resolve(context.signal); return release.promise; } });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'ZEN-1801' });
    const signal = await entered.promise; await rejection; expect(signal.aborted).toBe(true);
    const app = createApp(), dispose = vi.spyOn(app, 'dispose'); release.resolve(app);
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
  });
  it('claims a shared factory result only once across overlapping renders', async () => {
    const app = createApp(), dispose = vi.spyOn(app, 'dispose');
    const results = await Promise.allSettled([
      renderToString('<main>one</main>', {}, { app: async () => app }),
      renderToString('<main>two</main>', {}, { app: async () => app }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { code: 'ZEN-1001' } }); expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('rejects sequential reuse of a factory App without double disposal', async () => {
    const app = createApp(), dispose = vi.spyOn(app, 'dispose');
    await renderToString('<main>first</main>', {}, { app: () => app });
    await expect(renderToString('<main>second</main>', {}, { app: () => app })).rejects.toMatchObject({ code: 'ZEN-1001' });
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('does not start a factory when cancellation already won', async () => {
    const controller = new AbortController(); controller.abort(); const factory = vi.fn(() => createApp());
    await expect(renderToString('<main></main>', {}, { signal: controller.signal, app: factory })).rejects.toMatchObject({ name: 'AbortError' }); expect(factory).not.toHaveBeenCalled();
  });
  it('keeps surrogate pairs intact when independently UTF-8 encoding stream chunks', async () => {
    const parts: Buffer[] = [];
    for await (const chunk of renderToStream('<main>🚀🦊🌍</main>', {}, { deferHead: true, chunkSize: 1 })) parts.push(Buffer.from(chunk.html));
    const html = Buffer.concat(parts).toString('utf8'); expect(html).toContain('🚀🦊🌍'); expect(html).not.toContain('\ufffd');
  });
});

it('runs owned teardown in the same DOM context and preserves an original render error', async () => {
  let document: Document | undefined; let dispose: ReturnType<typeof vi.fn> | undefined;
  await expect(renderToString('<main>failure</main>', {}, { app: context => {
    document = context.document;
    const app = createApp(), original = app.dispose.bind(app);
    dispose = vi.spyOn(app, 'dispose').mockImplementation(() => { expect(globalThis.document).toBe(document); original(); throw new Error('cleanup failure'); });
    vi.spyOn(app, 'mount').mockImplementation(() => { throw new Error('original mount failure'); }); return app;
  } })).rejects.toThrow('original mount failure');
  expect(dispose).toHaveBeenCalledTimes(1); expect(document).toBeDefined(); expect('__zenithSSR__' in document!).toBe(false);
});
