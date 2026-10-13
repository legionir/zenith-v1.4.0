import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSuspense } from '../src/suspense';

describe('suspense error identity & minDelay state machine (#21, #22)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports two distinct Error objects with the same message (#21)', async () => {
    const api = createSuspense();
    const received: Error[] = [];
    const seenStateAtError: Array<{ signalErr: string | null; ctrlErr: Error | null }> = [];

    api.onError((err) => {
      received.push(err);
      seenStateAtError.push({
        signalErr: api.signal.get().error,
        ctrlErr: api.error.get(),
      });
    });

    const err1 = new Error('Network error');
    const err2 = new Error('Network error');

    api.track(Promise.reject(err1));
    await Promise.resolve();
    await Promise.resolve();

    api.track(Promise.reject(err2));
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toHaveLength(2);
    expect(received[0]).toBe(err1);
    expect(received[1]).toBe(err2);
    expect(seenStateAtError).toEqual([
      { signalErr: 'Network error', ctrlErr: err1 },
      { signalErr: 'Network error', ctrlErr: err2 },
    ]);

    api.dispose();
  });

  it('does not subscribe internal effect to its own output signals and shows loading after minDelay across overlapping tracks with mid-flight error (#22)', async () => {
    const api = createSuspense({ minDelay: 100 });
    const errors: Error[] = [];
    api.onError((e) => errors.push(e));

    let resolveP1!: () => void;
    let rejectP2!: (reason?: unknown) => void;
    let resolveP3!: () => void;

    const p1 = new Promise<void>((r) => {
      resolveP1 = r;
    });
    const p2 = new Promise<void>((_r, rej) => {
      rejectP2 = rej;
    });
    const p3 = new Promise<void>((r) => {
      resolveP3 = r;
    });

    // t = 0: track p1 and p2 (minDelay = 100ms)
    api.track(p1);
    api.track(p2);
    expect(api.loading.get()).toBe(false);

    // t = 40ms: p2 rejects in the middle while p1 is still pending, and p3 is tracked
    vi.advanceTimersByTime(40);
    rejectP2(new Error('mid-flight error'));
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toHaveLength(1);
    expect(api.loading.get()).toBe(false); // still before 100ms minDelay

    api.track(p3);

    // t = 99ms: still before minDelay
    vi.advanceTimersByTime(59);
    expect(api.loading.get()).toBe(false);

    // t = 100ms: minDelay reached -> loading must become true!
    vi.advanceTimersByTime(1);
    expect(api.loading.get()).toBe(true);

    // Settle remaining promises -> loading returns to false
    resolveP1();
    resolveP3();
    await Promise.resolve();
    await Promise.resolve();
    expect(api.loading.get()).toBe(false);

    api.dispose();
  });

  it('re-arms minDelay timer when a new track() starts after a single promise rejects (#22)', async () => {
    const api = createSuspense({ minDelay: 80 });
    let rejectP1!: (reason?: unknown) => void;
    let resolveP2!: () => void;

    api.track(
      new Promise<void>((_r, rej) => {
        rejectP1 = rej;
      }),
    );

    vi.advanceTimersByTime(30);
    rejectP1(new Error('first failed'));
    await Promise.resolve();
    await Promise.resolve();
    expect(api.loading.get()).toBe(false);

    // Start second track after first failed
    api.track(
      new Promise<void>((r) => {
        resolveP2 = r;
      }),
    );
    vi.advanceTimersByTime(79);
    expect(api.loading.get()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(api.loading.get()).toBe(true);

    resolveP2();
    await Promise.resolve();
    await Promise.resolve();
    expect(api.loading.get()).toBe(false);

    api.dispose();
  });
});
