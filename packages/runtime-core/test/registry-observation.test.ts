import { describe, expect, it, vi } from 'vitest';
import { logger, bufferSink } from '@zenith/logger';
import { createRegistry } from '../src/registry';

describe('reference registry observation (code-first, unrun)', () => {
  it('emits only reference names, with no notification from stale cleanup or missing unregister', () => {
    const registry = createRegistry<object>(); const events: Array<string | null> = [];
    const value = { secret: 'not-an-event-payload' }; const stop = registry.subscribe(name => events.push(name));
    const old = registry.register('same', value); const current = registry.register('same', value);
    old(); expect(events).toEqual(['same', 'same']);
    current(); current(); expect(events).toEqual(['same', 'same', 'same']);
    expect(registry.unregister('missing')).toBe(false); expect(events).toHaveLength(3);
    registry.register('other', value); expect(registry.unregister('other')).toBe(true);
    registry.dispose(); registry.dispose(); expect(events).toEqual(['same', 'same', 'same', 'other', 'other', null]);
    stop(); stop();
  });

  it('owns subscriptions and never accepts late listeners after disposal', () => {
    const registry = createRegistry<number>(); const listener = vi.fn(); const stop = registry.subscribe(listener);
    stop(); stop(); registry.register('a', 1); expect(listener).not.toHaveBeenCalled();
    registry.dispose(); const late = vi.fn(); registry.subscribe(late)();
    expect(late).not.toHaveBeenCalled();
  });

  it('isolates observer exceptions and does not leak their details to logs', () => {
    const registry = createRegistry<number>(); const sink = bufferSink(); const remove = logger.addSink(sink);
    const listener = vi.fn(); registry.subscribe(() => { throw new Error('observer-secret'); }); registry.subscribe(listener);
    try {
      const release = registry.register('session', 1); expect(registry.get('session')).toBe(1);
      expect(listener).toHaveBeenCalledWith('session'); release(); expect(registry.get('session')).toBeUndefined();
      expect(JSON.stringify(sink.entries())).not.toContain('observer-secret');
      expect(() => registry.dispose()).not.toThrow();
    } finally { remove(); }
  });

  it('allows reentrant reference replacement without making an old cleanup authoritative', () => {
    const registry = createRegistry<number>(); let replaced = false;
    registry.subscribe(name => { if (name === 'same' && !replaced) { replaced = true; registry.register('same', 2); } });
    const stale = registry.register('same', 1); expect(registry.get('same')).toBe(2);
    stale(); expect(registry.get('same')).toBe(2); registry.dispose();
  });
});
