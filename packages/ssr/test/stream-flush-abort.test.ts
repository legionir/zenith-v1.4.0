// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderToStream,
  defineServerComponent,
  registerServerComponent,
  clearServerComponents,
  type StreamChunk,
} from '../src/index';

describe('@zenith/ssr progressive stream flush & AbortSignal (#15)', () => {
  beforeEach(() => {
    clearServerComponents();
  });

  it('flushes head chunk before slow ServerComponent finishes and aborts immediately when signal fires mid-render', async () => {
    registerServerComponent(
      defineServerComponent('slow-panel', async () => {
        await new Promise((r) => setTimeout(r, 80));
        return `<div>Slow Panel Ready</div>`;
      }),
    );

    const flushed: StreamChunk[] = [];
    const controller = new AbortController();

    const stream = renderToStream(
      `<section><zen-server-component name="slow-panel"></zen-server-component></section>`,
      { title: 'Streaming' },
      {
        signal: controller.signal,
        onFlush(chunk) {
          flushed.push(chunk);
        },
      },
    );

    // 1st chunk (head) is yielded and flushed immediately before slow-panel finishes
    const first = await stream.next();
    expect(first.done).toBe(false);
    expect(flushed).toHaveLength(1);
    expect(flushed[0].html).toContain('__ZENITH_STATE__');

    // Abort mid-render while slow-panel is still pending
    setTimeout(() => controller.abort(), 10);
    await expect(stream.next()).rejects.toThrow(/aborted/i);
  });
});
