import { afterEach, expect, it, vi } from 'vitest';
import { clearScheduler, flushSync, Priority } from '@zenith/scheduler';
import {
  clearRegistry, createRoot, effect, getAllSignals, getCurrentPriority, getSignalInfo,
  getSignalObserver, getStateTimeline, nameSignal, onEffectError, onStateChange,
  registerSignal, setCurrentPriority, setSignalObserver, signal, type SignalObserver,
} from '../src';
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';

const cleanups: Array<() => void> = [];
const host = (): EffectContext => ({ owner: null, activeEffect: null, activeCleanupRegistration: null });
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  clearScheduler(); setEffectContextStore(null); clearRegistry(); setCurrentPriority(Priority.normal);
  onEffectError(null); vi.unstubAllGlobals();
});

it('uses installation identity rather than observer object equality for ABA and out-of-order teardown', () => {
  const base = getSignalObserver();
  const same: SignalObserver = {}, middle: SignalObserver = {};
  const first = setSignalObserver(same), second = setSignalObserver(middle), third = setSignalObserver(same);
  cleanups.push(first, second, third);
  first(); first(); expect(getSignalObserver()).toBe(same);
  third(); expect(getSignalObserver()).toBe(middle);
  second(); expect(getSignalObserver()).toBe(base);
});

it('does not resurrect a detached observer behind a temporary null override', () => {
  const base = getSignalObserver(); const observer: SignalObserver = {};
  const first = setSignalObserver(observer), mute = setSignalObserver(null);
  cleanups.push(first, mute); expect(getSignalObserver()).toBeNull();
  first(); mute(); expect(getSignalObserver()).toBe(base);
});

it('keeps equal error-handler installations independent and preserves replacement semantics', () => {
  const errors: unknown[] = [], handler = (error: unknown) => { errors.push(error); };
  const old = onEffectError(handler), current = onEffectError(handler); cleanups.push(old, current);
  old(); const failure = new Error('latest registration');
  effect(() => { throw failure; }); expect(errors).toEqual([failure]);
  current(); expect(() => effect(() => { throw new Error('no handler'); })).toThrow('no handler');
});

it('isolates default priorities between host contexts and restores the module fallback', () => {
  const previous = setCurrentPriority('high'); cleanups.push(() => setCurrentPriority(previous));
  const left = host(), right = host(); let current = left;
  setEffectContextStore(() => current);
  expect(getCurrentPriority()).toBe(Priority.normal); setCurrentPriority('urgent');
  current = right; expect(getCurrentPriority()).toBe(Priority.normal); setCurrentPriority('idle');
  current = left; expect(getCurrentPriority()).toBe(Priority.urgent);
  setEffectContextStore(null); expect(getCurrentPriority()).toBe(Priority.high);
});

it('does not create dependencies while inspecting a newly constructed Signal', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  createRoot(dispose => {
    let runs = 0; const made: ReturnType<typeof signal<number>>[] = [];
    effect(() => { runs++; made.push(signal(0)); });
    try {
      expect(made[0]?.subscriberCount).toBe(0);
      made[0]?.set(1); flushSync(); expect(runs).toBe(1);
    } finally { dispose(); made.forEach(value => value.dispose()); }
  });
});

it('honors an explicit devtools false even when the development default is enabled', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', false); vi.stubGlobal('__ZENITH_DEV__', true);
  const source = signal('private'); cleanups.push(() => source.dispose());
  expect(registerSignal(source)).toBe(-1); expect(getAllSignals()).toEqual([]);
});

it('does not let an old listener cleanup remove a fresh registration of the same callback', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const source = signal(0); cleanups.push(() => source.dispose()); const seen: unknown[] = [];
  const callback = (change: { newValue: unknown }) => { seen.push(change.newValue); };
  const old = onStateChange(callback); clearRegistry(); registerSignal(source);
  const current = onStateChange(callback); cleanups.push(old, current);
  old(); source.set(1); expect(seen).toEqual([1]); current(); source.set(2); expect(seen).toEqual([1]);
});

it('uses snapshot dispatch with immediate removals, deferred additions and untracked diagnostic reads', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const source = signal(0), unrelated = signal(0); cleanups.push(() => { source.dispose(); unrelated.dispose(); });
  const events: string[] = []; let removeSecond: () => void = () => {};
  let added = false;
  cleanups.push(onStateChange(() => {
    events.push('first'); removeSecond();
    if (!added) { added = true; cleanups.push(onStateChange(() => { events.push('later'); })); }
    unrelated.get();
  }));
  removeSecond = onStateChange(() => { events.push('removed'); }); cleanups.push(removeSecond);
  createRoot(dispose => {
    const trigger = signal(0); let runs = 0;
    effect(() => { trigger.get(); runs++; source.set(source.peek() + 1); });
    try {
      expect(events).toEqual(['first']); expect(unrelated.subscriberCount).toBe(0);
      unrelated.set(1); flushSync(); expect(runs).toBe(1);
      // unrelated is itself registered, so its diagnostic event is intentional.
      expect(events).toEqual(['first', 'first', 'later']);
    } finally { dispose(); trigger.dispose(); }
  });
});

it('aborts stale registration if a native peek clears the registry and bounds recursive inspection', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const source = signal(1); cleanups.push(() => source.dispose()); clearRegistry();
  const nativePeek = source.peek; let nested = 0;
  source.peek = () => { nested++; expect(registerSignal(source)).toBe(-1); return nativePeek.call(source); };
  const id = registerSignal(source); expect(id).toBeGreaterThan(0); expect(nested).toBe(1);
  clearRegistry(); source.peek = () => { clearRegistry(); return 1; };
  expect(registerSignal(source)).toBe(-1); expect(getAllSignals()).toEqual([]);
  source.peek = nativePeek; const next = registerSignal(source);
  expect(next).toBeGreaterThan(id); expect(getSignalInfo(next)?.signalRef.deref()).toBe(source);
});

it('shares actual Signal identity only with explicitly registered contexts and clears one context at a time', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const left = host(), right = host(); let current = left;
  setEffectContextStore(() => current);
  const source = signal(1); cleanups.push(() => source.dispose()); const leftId = registerSignal(source, 'left');
  current = right; expect(getSignalInfo(leftId)).toBeUndefined(); expect(getAllSignals()).toEqual([]);
  const rightId = registerSignal(source, 'right'); expect(rightId).not.toBe(leftId);
  nameSignal(source, 'renamed-right'); source.set(2);
  expect(getStateTimeline().map(change => change.signalId)).toEqual([rightId]);
  current = left; expect(getStateTimeline().map(change => change.signalId)).toEqual([leftId]);
  expect(getSignalInfo(leftId)?.name).toBe('left'); clearRegistry();
  current = right; expect(getSignalInfo(rightId)?.name).toBe('renamed-right');
  source.set(3); expect(getStateTimeline().at(-1)?.newValue).toBe(3); clearRegistry();
});

it('retires context registries through the host lifetime and refuses late resurrection', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const outside = signal('outside'); cleanups.push(() => outside.dispose()); const outsideId = registerSignal(outside);
  const disposal: Array<() => void> = [];
  const request = host(); request.registerDisposal = callback => { disposal.push(callback); };
  setEffectContextStore(() => request);
  const privateSignal = signal('request-only'); cleanups.push(() => privateSignal.dispose());
  expect(getAllSignals().map(info => info.value)).toEqual(['request-only']);
  expect(getSignalInfo(outsideId)).toBeUndefined(); expect(disposal).toHaveLength(1);
  for (const close of disposal) close();
  expect(getAllSignals()).toEqual([]); expect(registerSignal(privateSignal)).toBe(-1);
  clearRegistry(); expect(registerSignal(privateSignal)).toBe(-1);
  setEffectContextStore(null); expect(getSignalInfo(outsideId)?.value).toBe('outside');
});

it('does not let a failed lifetime registration leave a live inspection scope', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const request = host(); request.registerDisposal = () => { throw new Error('lifetime registration'); };
  setEffectContextStore(() => request);
  expect(() => signal('not recorded')).toThrow('lifetime registration');
  expect(getAllSignals()).toEqual([]); expect(registerSignal(signal('late'))).toBe(-1);
});

it('does not track a structural inspector peek implemented with reactive reads', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const dependency = signal(1), source = signal(0); clearRegistry();
  const nativePeek = source.peek; source.peek = () => dependency.get();
  createRoot(dispose => {
    let runs = 0; effect(() => { runs++; registerSignal(source); });
    try { expect(dependency.subscriberCount).toBe(0); dependency.set(2); flushSync(); expect(runs).toBe(1); }
    finally { dispose(); source.peek = nativePeek; source.dispose(); dependency.dispose(); }
  });
});

it('keeps the legacy timeline bounded without rewinding IDs on reset', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true); clearRegistry();
  const source = signal(0); cleanups.push(() => source.dispose()); const id = registerSignal(source);
  for (let value = 1; value <= 1005; value++) source.set(value);
  expect(getStateTimeline(2000)).toHaveLength(1000);
  expect(getStateTimeline(2000)[0]?.newValue).toBe(6); expect(getStateTimeline(2000).at(-1)?.newValue).toBe(1005);
  clearRegistry(); expect(registerSignal(source)).toBeGreaterThan(id);
});

it('applies host observation policy without erasing the process observer or scoped legacy inspection', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const creates: unknown[] = [], off = setSignalObserver({ onCreate: source => { creates.push(source); } });
  cleanups.push(off); const installed = getSignalObserver();
  const request = host(); request.globalObservation = false; setEffectContextStore(() => request);
  const privateSignal = signal('scoped'); cleanups.push(() => privateSignal.dispose());
  expect(creates).toEqual([]); expect(getSignalObserver()).toBe(installed);
  expect(getAllSignals().map(info => info.value)).toEqual(['scoped']); clearRegistry();
  setEffectContextStore(null); const outside = signal('outside'); cleanups.push(() => outside.dispose());
  expect(creates).toEqual([outside]);
});
