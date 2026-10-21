import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { signal } from '@zenith/state';
import { renderToStream, renderToReadableStream, renderToString, clearSSRTemplateCache, getSSRTemplateCacheStats, type StreamMetadata } from '../src';
afterEach(() => { clearSSRTemplateCache(); vi.restoreAllMocks(); });
it('retains its owned App until demand drains the DOM and never reads root.outerHTML', async () => {
  let dispose: ReturnType<typeof vi.fn> | undefined, document: Document | undefined; const ready = vi.fn((_metadata: StreamMetadata) => {});
  const stream = renderToStream('<main><p zen-text="text"></p></main>', { text: '🚀'.repeat(100) }, { chunkSize: 7, onReady: ready, app: context => {
    document = context.document; Object.defineProperty(document.querySelector('main')!, 'outerHTML', { get() { throw new Error('buffered full root'); } }); const app = createApp(); dispose = vi.spyOn(app, 'dispose'); return app;
  } });
  const head = await stream.next(); expect(head.value!.html).toContain('__ZENITH_STATE__'); expect(ready).toHaveBeenCalledTimes(1); expect(ready.mock.calls[0]![0]).not.toHaveProperty('html'); expect(dispose).not.toHaveBeenCalled();
  const chunks: string[] = [];
  while (true) { const next = await stream.next(); if (next.done) break; if (next.value.done) { expect(dispose).toHaveBeenCalledTimes(1); break; } chunks.push(next.value.html); }
  expect(chunks.every(chunk => chunk.length <= 8)).toBe(true); expect(chunks.join('')).toContain('🚀'.repeat(100)); expect(document!.body.innerHTML).toBe(''); await stream.return(undefined);
});
it('aborts a paused DOM session on iterator return and runs App cleanup in its DOM context', async () => {
  let dispose: ReturnType<typeof vi.fn> | undefined, requestSignal: AbortSignal | undefined, document: Document | undefined;
  const stream = renderToStream('<main>pending body</main>', {}, { app: context => {
    document = context.document; requestSignal = context.signal; const app = createApp(), original = app.dispose.bind(app); dispose = vi.spyOn(app, 'dispose').mockImplementation(() => { expect(globalThis.document).toBe(document); original(); }); return app;
  } });
  await stream.next(); expect(dispose).not.toHaveBeenCalled(); await stream.return(undefined); expect(dispose).toHaveBeenCalledTimes(1); expect(requestSignal?.aborted).toBe(true); expect('__zenithSSR__' in document!).toBe(false);
});
it('preserves full HTML for legacy onRendered and shell callbacks', async () => {
  const rendered = vi.fn(result => { expect(result.html).toContain('Legacy'); }), opening = vi.fn(result => `<document data-length="${result.html.length}">`), parts: string[] = [];
  for await (const chunk of renderToStream('<main>Legacy</main>', {}, { app: () => createApp(), onRendered: rendered, shell: { open: opening, close: '</document>' } })) parts.push(chunk.html);
  expect(rendered).toHaveBeenCalledTimes(1); expect(opening).toHaveBeenCalledTimes(1); expect(parts.join('')).toContain('<main>Legacy</main>'); expect(parts.join('')).toMatch(/^<document data-length="[1-9]/);
});
it('releases an App after an onReady/onFlush callback failure without replacing that failure', async () => {
  for (const hook of ['onReady', 'onFlush'] as const) {
    let dispose: ReturnType<typeof vi.fn> | undefined; const failure = new Error(`failure-${hook}`);
    const stream = renderToStream('<main>failure</main>', {}, { app: () => { const app = createApp(); dispose = vi.spyOn(app, 'dispose'); return app; }, [hook]: () => { throw failure; } });
    await expect(stream.next()).rejects.toBe(failure); expect(dispose).toHaveBeenCalledTimes(1);
  }
});
it('cancels a Web stream retained for backpressure and observes its disposal before cancellation resolves', async () => {
  let dispose: ReturnType<typeof vi.fn> | undefined;
  const stream = renderToReadableStream('<main>body</main>', {}, { chunkSize: 1, app: () => { const app = createApp(); dispose = vi.spyOn(app, 'dispose'); return app; } }); const reader = stream.getReader(); await reader.read(); await reader.cancel(); expect(dispose).toHaveBeenCalledTimes(1);
});
it('does not lend a request Window or its head/storage/globals through the template cache', async () => {
  const template = '<main>request</main>'; let first: Document | undefined;
  await renderToString(template, {}, { app: context => { first = context.document; (first.defaultView as Window & { requestLeak?: string }).requestLeak = 'secret'; first.head.innerHTML = '<meta name="private" content="secret">'; first.body.setAttribute('data-private', 'secret'); first.defaultView!.localStorage.setItem('private', 'secret'); return createApp(); } });
  await renderToString(template, {}, { app: context => {
    expect(context.document).not.toBe(first); expect((context.document.defaultView as Window & { requestLeak?: string }).requestLeak).toBeUndefined(); expect(context.document.head.querySelector('[name="private"]')).toBeNull(); expect(context.document.body.hasAttribute('data-private')).toBe(false); expect(context.document.defaultView!.localStorage.getItem('private')).toBeNull(); return createApp();
  } }); expect(getSSRTemplateCacheStats().parseCountFor(template)).toBe(1);
});
it('takes one legacy fast-head state snapshot so later source writes cannot disagree with its body', async () => {
  const source = signal('initial'), stream = renderToStream('<main zen-text="name"></main>', { name: source });
  try { const first = await stream.next(); expect(first.value!.html).toContain('initial'); source.set('later'); const rest: string[] = []; for await (const chunk of stream) rest.push(chunk.html); expect(rest.join('')).toContain('initial'); expect(rest.join('')).not.toContain('later'); expect(source.get()).toBe('later'); } finally { await stream.return(undefined); source.dispose(); }
});
it('isolates shared caller signals for 100 overlapping streamed Apps', async () => {
  const source = signal('source'), shared = { count: 1 }, disposals: ReturnType<typeof vi.fn>[] = [];
  try {
    const outputs = await Promise.all(Array.from({ length: 100 }, async (_, id) => {
      const parts: string[] = [];
      for await (const chunk of renderToStream('<main><p zen-text="name"></p></main>', { name: source, nested: shared }, { route: `/stream-${id}`, chunkSize: 13, app: async context => {
        const doc = context.document; await Promise.resolve(); expect(globalThis.document).toBe(doc); (context.state.name as typeof source).set(`request-${id}`); (context.state.nested as typeof shared).count = id; context.head.push({ title: `title-${id}` }); const app = createApp(); disposals.push(vi.spyOn(app, 'dispose')); return app;
      } })) parts.push(chunk.html);
      return parts.join('');
    }));
    outputs.forEach((html, id) => { expect(html).toContain(`>request-${id}</p>`); expect(html).toContain(`title-${id}`); expect(html).toContain(`/stream-${id}`); }); expect(source.get()).toBe('source'); expect(shared.count).toBe(1); disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  } finally { source.dispose(); }
});
it('does not repopulate the template cache when a live stream finishes after clear', async () => {
  const stream = renderToStream('<main>live</main>', {}, { app: () => createApp() }); await stream.next(); clearSSRTemplateCache(); await stream.return(undefined); expect(getSSRTemplateCacheStats().pooledDOMInstances).toBe(0); expect(getSSRTemplateCacheStats().cachedTemplates).toBe(0);
});
it('does not retain private HTML diagnostic keys when template caching is disabled', async () => {
  clearSSRTemplateCache(); const html = '<main>private uncached markup</main>'; await renderToString(html, {}, { cacheTemplates: false, app: () => createApp() }); expect(getSSRTemplateCacheStats().cachedTemplates).toBe(0); expect(getSSRTemplateCacheStats().parseCountFor(html)).toBe(0);
});
