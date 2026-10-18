import { afterEach, expect, it, vi } from 'vitest';
import { clearRegistry, getAllSignals, getStateTimeline, onStateChange, registerSignal, signal } from '../src';
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';
import { _runInEffectContext } from '../src/context';

const host = (): EffectContext => ({ owner: null, activeEffect: null, activeCleanupRegistration: null });
afterEach(() => { setEffectContextStore(null); clearRegistry(); vi.unstubAllGlobals(); });

it('does not send an in-progress native event to a re-registered scope from a new generation', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const left = host(), right = host(); let current = left; setEffectContextStore(() => current);
  const source = signal(0), leftId = registerSignal(source); current = right; registerSignal(source);
  const seen: string[] = [];
  current = left;
  const offLeft = onStateChange(() => {
    seen.push('left');
    _runInEffectContext(right, () => {
      clearRegistry(); registerSignal(source); onStateChange(() => { seen.push('new-right'); });
    });
  });
  try {
    source.set(1); expect(seen).toEqual(['left']);
    expect(getStateTimeline().map(change => change.signalId)).toEqual([leftId]);
    current = right; expect(getStateTimeline()).toEqual([]);
    // Neither view invents a wrapped copy of the underlying Signal.
    expect(getAllSignals()[0]?.signalRef.deref()).toBe(source);
  } finally {
    offLeft(); clearRegistry(); current = left; clearRegistry(); source.dispose();
  }
});
