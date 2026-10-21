import { describe, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { headPlugin } from '@zenith/head';
import { uiPlugin } from '@zenith/ui';
import { renderToString, renderToStream, renderToReadableStream, useHead } from '../src';
describe('SSR request owners', () => {
  it('isolates 100 App/head/locale factories and disposes each owned instance', async () => {
    const disposals: ReturnType<typeof vi.fn>[] = [];
    const results = await Promise.all(Array.from({ length: 100 }, (_, index) => renderToString('<main><h1 zen-text="name"></h1><span zen-head-title="name"></span></main>', { name: `request-${index}` }, {
      locale: index % 2 ? 'fa' : 'en',
      app: () => {
        useHead({ meta: [{ name: 'description', content: `owner-${index}` }] });
        const app = createApp({ plugins: [headPlugin()] }); const dispose = vi.spyOn(app, 'dispose'); disposals.push(dispose); return app;
      },
    })));
    results.forEach((result, index) => { expect(result.html).toContain(`request-${index}`); expect(result.headTags).toContain(`<title data-zen-head="title">request-${index}</title>`); expect(result.headTags).toContain(`owner-${index}`); expect(result.htmlAttrs).toContain(index % 2 ? 'lang="fa"' : 'lang="en"'); });
    expect(disposals).toHaveLength(100); disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });
  it('disposes a factory App when mount fails, without swallowing the render error', async () => {
    let dispose: ReturnType<typeof vi.fn> | undefined;
    await expect(renderToString('<main></main>', {}, { app: () => { const app = createApp(); dispose = vi.spyOn(app, 'dispose'); vi.spyOn(app, 'mount').mockImplementation(() => { throw new Error('mount failed'); }); return app; } })).rejects.toThrow('mount failed');
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('does not dispose a caller-borrowed App', async () => { const app = createApp(); const dispose = vi.spyOn(app, 'dispose'); await renderToString('<main>borrowed</main>', {}, { app }); expect(dispose).not.toHaveBeenCalled(); app.dispose(); });
  it('requires an explicit head outside a render request', () => { expect(() => useHead({ title: 'no ambient request' })).toThrow(); });
});

it('keeps UI-generated IDs deterministic when a pooled Document serves another request', async () => {
  const template = '<main><section zen-dialog><h2 zen-dialog-title>Confirm</h2><button>Okay</button></section></main>';
  const options = { app: () => createApp({ plugins: [uiPlugin()] }) };
  const first = await renderToString(template, {}, options); const second = await renderToString(template, {}, options);
  expect(first.html).toBe(second.html); expect(first.html).toContain('aria-labelledby="dialog-title-1"');
});

it('serializes App head/root locale and disposes the factory owner in both stream APIs', async () => {
  const disposals: ReturnType<typeof vi.fn>[] = [];
  const options = { locale: 'fa', nonce: 'response-nonce', app: () => { const app = createApp({ plugins: [headPlugin()] }); disposals.push(vi.spyOn(app, 'dispose')); return app; } };
  const template = '<main><h1 zen-text="title"></h1><span zen-head-title="title"></span></main>';
  let html = ''; for await (const chunk of renderToStream(template, { title: 'Stream title' }, options)) html += chunk.html;
  expect(html).toContain('<title data-zen-head="title">Stream title</title>'); expect(html).toContain('lang="fa"'); expect(html).toContain('dir="rtl"'); expect(html).toContain('nonce="response-nonce"');
  const readable = renderToReadableStream(template, { title: 'Readable title' }, options); const output = await new Response(readable).text();
  expect(output).toContain('<title data-zen-head="title">Readable title</title>'); expect(output).toContain('lang="fa"'); disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1)); expect(disposals).toHaveLength(2);
});

it('does not emit invalid empty hydration JavaScript when state serialization is disabled', async () => {
  const result = await renderToString('<main></main>', {}, { serializeState: false });
  const { generateHydrationScript } = await import('../src'); expect(generateHydrationScript(result)).toContain('__ZENITH_STATE__={}');
});

it('isolates lower-layer registries across async server components and tears down request-owned resources', async () => {
  const { createResource, getResource } = await import('@zenith/resource');
  const { createPermissionManager, getPermissionManager } = await import('@zenith/permission');
  const { defineStore } = await import('@zenith/store');
  const useCounter = defineStore('per-request', { state: () => ({ count: 0 }) });
  const disposals: Array<{ mock: { calls: unknown[][] } }> = [];
  const values = await Promise.all(Array.from({ length: 20 }, (_, index) => renderToString('<zen-server-component name="private"></zen-server-component>', {}, {
    serverComponents: { private: async () => {
      const resource = createResource('per-request', { url: `/items/${index}` }); disposals.push(vi.spyOn(resource, 'dispose'));
      const store = useCounter(); const permissions = createPermissionManager('per-request');
      await Promise.resolve();
      expect(getResource('per-request')).toBe(resource); expect(getPermissionManager('per-request')).toBe(permissions); expect(useCounter()).toBe(store);
      return `<p>owner-${index}</p>`;
    } },
  })));
  values.forEach((value, index) => expect(value.html).toContain(`owner-${index}`));
  disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1)); expect(disposals).toHaveLength(20);
});
