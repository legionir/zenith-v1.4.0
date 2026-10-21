import { describe, it, expect } from 'vitest';
import { ActionRegistry } from '../src/index';

describe('@zenith/actions middleware race & override safety (#15)', () => {
  it('isolates in-flight middleware pipeline from concurrent use()/clear() mutations and picks up overridden handler', async () => {
    const registry = new ActionRegistry();
    const order: string[] = [];

    registry.register('save', () => {
      order.push('handler-v1');
    });

    registry.use(async (_name, _ctx, next) => {
      order.push('mw1-before');
      // Mutate middlewares and override handler mid-flight
      registry.use((_n, _c, nxt) => {
        order.push('late-mw');
        return nxt();
      });
      registry.register('save', () => {
        order.push('handler-v2');
      });
      await new Promise((r) => setTimeout(r, 5));
      await next();
      order.push('mw1-after');
    });

    await registry.execute('save', {
      event: new Event('click'),
      state: {},
      element: {} as HTMLElement,
    });

    // Late middleware added mid-flight did not corrupt the in-flight chain,
    // and the updated handler-v2 ran at the end of the pipeline.
    expect(order).toEqual(['mw1-before', 'handler-v2', 'mw1-after']);
  });

  it('throws ZenithError if a middleware calls next() multiple times', async () => {
    const registry = new ActionRegistry();
    registry.register('ping', () => {});
    registry.use(async (_name, _ctx, next) => {
      await next();
      await next();
    });

    await expect(
      registry.execute('ping', {
        event: new Event('click'),
        state: {},
        element: {} as HTMLElement,
      }),
    ).rejects.toThrow(/multiple times/i);
  });
});
