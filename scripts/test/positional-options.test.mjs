// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetDeprecationWarnings } from '../../packages/errors/src';
import { createMutation, createInfiniteQuery } from '../../packages/data/src';
import { createSuspenseContext, trackPromise, withTimeout } from '../../packages/suspense/src';
import { animate, animateEnter, animateLeave } from '../../packages/transition/src';

describe('options-object signatures for >2 param functions (#55)', () => {
  beforeEach(() => {
    resetDeprecationWarnings();
    vi.restoreAllMocks();
  });

  it('createMutation supports { fn, ...options } and deprecates positional createMutation(fn, options)', async () => {
    const onSuccess = vi.fn();
    const mutation = createMutation({
      fn: async (x) => x * 2,
      onSuccess,
    });
    const res = await mutation.mutate(21);
    expect(res).toBe(42);
    expect(mutation.data.get()).toBe(42);
    expect(onSuccess).toHaveBeenCalledWith(42, 21);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const legacy = createMutation(async (x) => x + 1, {});
    expect(await legacy.mutate(9)).toBe(10);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-035'));
  });

  it('createInfiniteQuery supports { key, fn, ...options } and deprecates positional createInfiniteQuery(key, fn, options)', async () => {
    const query = createInfiniteQuery({
      key: 'posts',
      initialPageParam: 1,
      fn: async (page) => ({ items: [page * 10], nextPage: page < 2 ? page + 1 : null }),
      getNextPageParam: (lastPage) => lastPage.nextPage,
    });

    await query.fetchNextPage();
    expect(query.pages.get()).toHaveLength(1);
    expect(query.hasNextPage.get()).toBe(true);

    await query.fetchNextPage();
    expect(query.pages.get()).toHaveLength(2);
    expect(query.hasNextPage.get()).toBe(false);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createInfiniteQuery('legacy-posts', async (p) => p, {
      getNextPageParam: () => null,
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-036'));
  });

  it('trackPromise and withTimeout accept options objects and deprecate positional args', async () => {
    const ctx = createSuspenseContext({ timeoutMs: 0 });
    const result = await trackPromise(Promise.resolve('done'), {
      suspense: ctx,
      key: 'load-1',
      timeout: 500,
    });
    expect(result).toBe('done');
    expect(ctx.signal.get().loading).toBe(false);

    await expect(
      withTimeout(new Promise((r) => setTimeout(r, 100)), {
        ms: 10,
        message: 'Custom timeout message',
      }),
    ).rejects.toThrow('Custom timeout message');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await trackPromise(Promise.resolve(1), ctx, 'legacy-key', 100);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-037'));

    await withTimeout(Promise.resolve('ok'), 100, 'legacy');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-038'));
  });

  it('animate, animateEnter, and animateLeave accept options objects and deprecate positional args', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const onFinish = vi.fn();

    await animate(el, {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      duration: 50,
      easing: 'ease-out',
      onFinish,
    });
    expect(onFinish).toHaveBeenCalledTimes(1);

    const enterRun = animateEnter(el, { name: 'fade', duration: 10 });
    enterRun.cancel();
    const leaveRun = animateLeave(el, { name: 'fade', duration: 10 });
    leaveRun.cancel();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await animate(el, [{ opacity: 0 }, { opacity: 1 }], 20, 'ease');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-039'));

    animateEnter(el, 'fade', 10).cancel();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-040'));

    animateLeave(el, 'fade', 10).cancel();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-041'));

    el.remove();
  });
});
