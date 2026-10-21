import { expect, it, vi, afterEach } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { headPlugin } from '@zenith/head';
import { renderToString, renderToStream, renderSSRHead } from '../src';
import { resetDeprecationWarnings } from '@zenith/errors';
import { setHostPrinter } from '@zenith/errors/internal';
afterEach(() => { resetDeprecationWarnings(); });
const template = '<main><zen-head><title>Base</title><meta name="author" content="Example"><script type="application/ld+json">{"text":"<tag>"}</script></zen-head><div zen-head-title="$title" zen-head-description="$description"></div><p zen-text="title"></p></main>';
it('isolates authored head projections and scalar directives across 100 overlapping SSR Apps', async () => {
  const releases: ReturnType<typeof vi.fn>[] = [], documents = new Set<Document>();
  const results = await Promise.all(Array.from({ length: 100 }, (_, id) => renderToString(template, { title: `request-${id}`, description: `private-${id}` }, {
    nonce: `nonce-${id}`, app: async context => {
      documents.add(context.document); await Promise.resolve(); const app = createApp(); releases.push(vi.spyOn(app, 'dispose')); app.use(headPlugin({ document: context.document, nonce: `nonce-${id}` })); return app;
    },
  })));
  expect(documents.size).toBe(100);
  results.forEach((result, id) => {
    expect(result.headTags).toContain(`>request-${id}</title>`); expect(result.headTags).toContain(`content="private-${id}"`); expect(result.headTags).toContain(`nonce="nonce-${id}"`); expect(result.headTags).toContain('\\u003ctag\\u003e'); expect(result.html).not.toContain('<meta'); expect(result.html).not.toContain('<script type="application/ld+json"'); expect(result.html).toContain(`>request-${id}</p>`);
  });
  releases.forEach(release => expect(release).toHaveBeenCalledTimes(1));
});
it('captures the projected head before releasing a streamed App and restores authored nodes on return', async () => {
  let document: Document | undefined, dispose: ReturnType<typeof vi.fn> | undefined;
  const stream = renderToStream(template, { title: 'Stream', description: '' }, { app: context => {
    document = context.document; const app = createApp(); dispose = vi.spyOn(app, 'dispose'); app.use(headPlugin({ document })); return app;
  } });
  try {
    const first = await stream.next(); expect(first.value!.html).toContain('>Stream</title>'); expect(dispose).not.toHaveBeenCalled(); expect(document!.querySelector('zen-head')!.children).toHaveLength(0);
  } finally { await stream.return(undefined); }
  expect(dispose).toHaveBeenCalledTimes(1); expect(document!.body.innerHTML).toBe('');
});
it('#55 renderSSRHead accepts { i18n, fallbackLocale } with the same attrs and warns once on the positional form (ZEN-DEPR-107)', () => {
  const messages: string[] = [];
  const release = setHostPrinter((_severity, title) => messages.push(title));
  try {
    const canonical = renderSSRHead('', { i18n: { locale: 'fa' }, fallbackLocale: 'en' });
    expect(canonical.htmlAttrs).toContain('lang="fa"');
    expect(canonical.htmlAttrs).toContain('dir="rtl"');
    expect(messages.some((message) => message.includes('ZEN-DEPR-107'))).toBe(false);
    const legacy = renderSSRHead('', { locale: 'fa' }, 'en');
    expect(legacy).toEqual(canonical);
    const fallbackOnly = renderSSRHead('', undefined, 'en');
    expect(fallbackOnly).toEqual(renderSSRHead('', { fallbackLocale: 'en' }));
    expect(messages.filter((message) => message.includes('ZEN-DEPR-107'))).toHaveLength(1);
    expect(messages[0]).toContain('renderSSRHead(head, { i18n, fallbackLocale })');
  } finally {
    release();
  }
});
