import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderToString,
  renderToStream,
  renderToReadableStream,
  clearSSRTemplateCache,
  getSSRTemplateCacheStats,
} from '../src/index';
import { ZenithError } from '@zenith/errors';

describe('@zenith/ssr true streaming, template cache, and render timeout (#91)', () => {
  beforeEach(() => {
    clearSSRTemplateCache();
  });

  it('caches parsed HTML templates across repeated sequential renders and preserves output', async () => {
    const html = '<div id="root"><h1 zen-text="$title"></h1><p zen-text="$count"></p></div>';
    const first = await renderToString(html, { title: 'سلام', count: 1 });
    for (let i = 2; i <= 15; i++) {
      const next = await renderToString(html, { title: 'سلام', count: i });
      expect(next.html).toContain(`<p zen-text="$count">${i}</p>`);
    }
    const stats = getSSRTemplateCacheStats();
    // Template was parsed only once into the pooled JSDOM template cache
    expect(stats.parseCountFor(html)).toBe(1);
    expect(stats.pooledDOMInstances).toBeGreaterThanOrEqual(1);
    expect(first.html).toContain('<h1 zen-text="$title">سلام</h1>');
  });

  it('throws ZenithError ZEN-1801 when SSR render exceeds timeout / renderTimeoutMs', async () => {
    const html = '<div><zen-server-component name="slow-box"></zen-server-component></div>';
    await expect(
      renderToString(
        html,
        {},
        {
          timeout: 30,
          serverComponents: {
            'slow-box': async () => {
              await new Promise((r) => setTimeout(r, 200));
              return '<span>Done</span>';
            },
          },
        },
      ),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof ZenithError && err.code === 'ZEN-1801';
    });
  });

  it('supports Web ReadableStream backpressure (pull-on-demand) and cancel() in renderToReadableStream', async () => {
    const flushed: string[] = [];
    const html = `<section id="feed">${'<p zen-text="$msg"></p>'.repeat(10)}</section>`;
    const stream = renderToReadableStream(
      html,
      { msg: 'قطعه جریان' },
      {
        chunkSize: 60,
        onFlush: (chunk) => {
          flushed.push(chunk.html);
        },
      },
    );

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    // Before first read, at most 1 chunk is pulled
    const firstRead = await reader.read();
    expect(firstRead.done).toBe(false);
    expect(decoder.decode(firstRead.value)).toContain('<!DOCTYPE html>');
    const flushedAfterFirst = flushed.length;
    expect(flushedAfterFirst).toBeLessThanOrEqual(2);

    // Read remaining chunks
    let fullText = decoder.decode(firstRead.value);
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
    }
    expect(fullText).toContain('قطعه جریان');
    expect(fullText).toContain('</div></body></html>');
    expect(flushed.length).toBeGreaterThan(3);
  });

  it('cancels in-flight streaming render when reader.cancel() is invoked', async () => {
    let aborted = false;
    const controller = new AbortController();
    controller.signal.addEventListener('abort', () => {
      aborted = true;
    });

    const stream = renderToReadableStream(
      '<div><!--zen-server:slow--></div>',
      {},
      {
        signal: controller.signal,
        serverComponents: {
          slow: async () => {
            await new Promise((r) => setTimeout(r, 300));
            return '<p>slow</p>';
          },
        },
      },
    );

    const reader = stream.getReader();
    const head = await reader.read();
    expect(head.done).toBe(false);
    await reader.cancel('Client disconnected');
    expect(aborted).toBe(false); // external controller wasn't aborted, internal was

    // Also verify explicit AbortSignal abort on renderToStream
    const gen = renderToStream(
      '<div><span zen-text="$x"></span></div>',
      { x: 1 },
      { signal: AbortSignal.abort() },
    );
    await expect(gen.next()).rejects.toThrow(/aborted/i);
  });
});
