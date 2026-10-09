// #27 core tests for @zenith/scheduler — queueing, priority order, dedup,
// disposal, flushSync, afterFlush, max-iteration guard.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  scheduleEffect,
  flushSync,
  hasPendingEffects,
  pendingEffectCount,
  pendingEffectsByPriority,
  clearScheduler,
  afterFlush,
  nextTick,
  Priority,
} from '@zenith/scheduler';

beforeEach(() => clearScheduler());

describe('queueing', () => {
  it('does not run scheduled tasks synchronously', () => {
    let ran = false;
    scheduleEffect(() => {
      ran = true;
    });
    expect(ran).toBe(false);
    expect(hasPendingEffects()).toBe(true);
    flushSync();
    expect(ran).toBe(true);
    expect(hasPendingEffects()).toBe(false);
  });

  it('dedupes the same task fn even if scheduled with different priorities', () => {
    const fn = vi.fn();
    scheduleEffect(fn, Priority.low);
    scheduleEffect(fn, Priority.urgent);
    expect(pendingEffectCount()).toBe(1);
    expect(pendingEffectsByPriority(Priority.urgent)).toBe(1);
    flushSync();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('nextTick schedules with idle priority', () => {
    nextTick(() => {});
    expect(pendingEffectsByPriority(Priority.idle)).toBe(1);
  });
});

describe('priority ordering', () => {
  it('runs urgent before normal before idle (within one flush)', () => {
    const order: string[] = [];
    scheduleEffect(() => order.push('idle'), Priority.idle);
    scheduleEffect(() => order.push('normal'), Priority.normal);
    scheduleEffect(() => order.push('urgent'), Priority.urgent);
    flushSync();
    expect(order).toEqual(['urgent', 'normal', 'idle']);
  });

  it('preserves insertion order within the same priority', () => {
    const order: number[] = [];
    for (let i = 0; i < 5; i++) {
      const n = i;
      scheduleEffect(() => order.push(n), Priority.normal);
    }
    flushSync();
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  it('accepts string priorities (legacy)', () => {
    let ran = false;
    scheduleEffect(() => {
      ran = true;
    }, 'high' as any);
    flushSync();
    expect(ran).toBe(true);
  });
});

describe('disposal', () => {
  it('skips tasks whose disposed() returns true', () => {
    let disposed = false;
    let ran = false;
    scheduleEffect(
      () => {
        ran = true;
      },
      Priority.normal,
      () => disposed,
    );
    disposed = true;
    flushSync();
    expect(ran).toBe(false);
    expect(pendingEffectCount()).toBe(0);
  });

  it('a throwing task does not stop the rest of the queue', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let secondRan = false;
    scheduleEffect(() => {
      throw new Error('boom');
    }, Priority.urgent);
    scheduleEffect(() => {
      secondRan = true;
    }, Priority.normal);
    flushSync();
    expect(secondRan).toBe(true);
    errSpy.mockRestore();
  });
});

describe('afterFlush', () => {
  it('fires callbacks after the queue drains, once', () => {
    const cb = vi.fn();
    const unregister = afterFlush(cb);
    scheduleEffect(() => {});
    flushSync();
    expect(cb).toHaveBeenCalledTimes(1);
    flushSync();
    expect(cb).toHaveBeenCalledTimes(1); // consumed
    unregister();
  });

  it('unregister prevents the callback from firing', () => {
    const cb = vi.fn();
    const unregister = afterFlush(cb);
    unregister();
    scheduleEffect(() => {});
    flushSync();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('runaway protection', () => {
  it('clears the queue and logs when a task re-schedules itself forever', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let selfId = 0;
    const selfResched = () => {
      selfId++;
      // different fn each time to bypass Map dedup → simulate infinite growth
      scheduleEffect(() => {
        if (selfId < 1000) selfResched();
      });
    };
    selfResched();
    flushSync();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Infinite loop detected'));
    expect(hasPendingEffects()).toBe(false);
    errSpy.mockRestore();
  });
});

describe('clearScheduler', () => {
  it('drops all pending tasks', () => {
    const fn = vi.fn();
    scheduleEffect(fn);
    clearScheduler();
    flushSync();
    expect(fn).not.toHaveBeenCalled();
  });
});
