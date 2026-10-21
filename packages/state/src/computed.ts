import { type Signal, signal, type ReadonlySignal, untrack } from './signal';
import { effect } from './effect';
import { createOwner, disposeOwner, getOwner, _getMutableContext, _bindToEffectContext } from './context';
import { developerError } from '@zenith/errors';
import { ZENITH_READABLE } from './readable';

type ComputedState<T> = { kind: 'empty' } | { kind: 'ready'; signal: Signal<T> };

/** A lazy, owned derived value with real readonly capabilities. @public */
export class Computed<T> implements ReadonlySignal<T> {
  private _state: ComputedState<T> = { kind: 'empty' };
  private _initializing = false;
  private readonly _owner = createOwner(getOwner());

  private _computation: (() => T) | undefined;
  private _initializeInContext: (() => Signal<T>) | undefined;
  constructor(computation: () => T) {
    this._computation = this._owner.disposed ? undefined : computation;
    if (this._owner.disposed) return;
    try { this._initializeInContext = _bindToEffectContext(_getMutableContext(), () => this._initialize()); }
    catch (error) { disposeOwner(this._owner); this._computation = undefined; throw error; }
    if (this._owner.disposed) {
      this._computation = undefined; this._initializeInContext = undefined; return;
    }
    // No invented T/undefined placeholder signal. First successful evaluation
    // creates the actual typed signal; its owner releases subscribers once.
    this._owner.cleanup.add(() => {
      this._computation = undefined;
      this._initializeInContext = undefined;
      if (this._state.kind === 'ready') this._state.signal.dispose();
    });
  }

  get(): T {
    const state = this._state;
    if (state.kind === 'ready') {
      // Disposal is terminal: cached reads are snapshots, never new subscriptions.
      return this._owner.disposed ? state.signal.peek() : state.signal.get();
    }
    if (this._owner.disposed) throw developerError('Cannot initialize a disposed computed value');
    const initialize = this._initializeInContext;
    if (!initialize) throw developerError('Cannot initialize a disposed computed value');
    // Initialize in the producer context, then subscribe in the reader context.
    return initialize().get();
  }

  peek(): T { return untrack(() => this.get()); }
  get subscriberCount(): number { return this._state.kind === 'ready' ? this._state.signal.subscriberCount : 0; }
  removeSubscriber(subscriber: Parameters<Signal<T>['removeSubscriber']>[0]): void {
    if (this._state.kind === 'ready') this._state.signal.removeSubscriber(subscriber);
  }

  private _initialize(): Signal<T> {
    if (this._initializing) throw developerError('Circular computed initialization');
    this._initializing = true;
    const initial: { signal?: Signal<T>; failure?: { error: unknown } } = {};
    let first = true;
    try {
      const stop = effect(() => {
        try {
          const computation = this._computation;
          if (!computation) throw developerError('Cannot evaluate a disposed computed value');
          const value = computation();
          if (this._owner.disposed) {
            if (first) throw developerError('Computed owner was disposed during initialization');
            return;
          }
          if (first) {
            // Observer/legacy registry reads during construction must not make
            // the computed subscribe to its own signal.
            const inner = untrack(() => signal(value));
            if (this._owner.disposed) { inner.dispose(); throw developerError('Computed owner was disposed during initialization'); }
            this._state = { kind: 'ready', signal: inner };
            initial.signal = inner;
            first = false;
          } else {
            const state = this._state;
            if (state.kind === 'ready' && !Object.is(value, state.signal.peek())) untrack(() => state.signal.set(value));
          }
        } catch (error) {
          // Preserve initial synchronous failure (including thrown undefined)
          // without routing it through the effect error hub or fabricating T.
          if (first) initial.failure = { error };
          else throw error;
        }
      }, { owner: this._owner });
      if (initial.failure) { stop(); throw initial.failure.error; }
      if (!initial.signal) { stop(); throw developerError('Computed initialization did not produce a value'); }
      return initial.signal;
    } finally { this._initializing = false; }
  }

  /** Idempotent terminal disposal; initialized values retain only their last snapshot. */
  dispose(): void { disposeOwner(this._owner); }
}

/** Create a lazy derived value; dependencies belong to its own tracking effect. @public */
export function computed<T>(computation: () => T): ReadonlySignal<T> { return new Computed(computation); }
Reflect.set(Computed.prototype, ZENITH_READABLE, true);
