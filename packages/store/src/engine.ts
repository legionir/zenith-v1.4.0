import { signal, computed } from '@zenith/state';
import { createDisposer } from '@zenith/shared';
import { developerError, ErrorCode } from '@zenith/errors';
import type { Store, StoreBase, StoreDefinition, StoreActionContext, StorePlugin } from './types';
import { storeRegistry, storePluginsFor, setStoreOwner } from './registry';
import { deepMerge, createProxyFactory, isSafeStateKey, isPlainStateObject } from './proxy';
import { persistStore } from './persist';
import { assignStateKey } from './state-write';

/** @public */
export function defineStore<
  S,
  G extends Record<string, (state: S) => unknown> = Record<never, never>,
  A extends Record<string, (...args: never[]) => unknown> = Record<never, never>,
>(id: string, def: StoreDefinition<S, G, A>): () => Store<S, G, A> {
  return () => {
    // اگر قبلاً ساخته شده، همان را برگردان.
    if (storeRegistry.has(id)) {
      return storeRegistry.get(id) as Store<S, G, A>;
    }

    // ── State: raw object که proxy آن را IN PLACE mutate می‌کند ──
    const stateObj = def.state();
    const { createInPlaceDeepProxy } = createProxyFactory();
    const owned = createDisposer(); let releaseRegistration: () => void = () => {}; let isDisposed = false;
    try {

    // versionSignal: هر mutation یک increment می‌کند. این Signal توسط
    // getterهای reactive و effectهای وابسته track می‌شود.
    const versionSignal = signal<number>(0); owned.add(versionSignal);

    // #145 — اشتراک همگانی state (PersistTarget در @zenith/storage):
    // cb همان stateObj (in-place) را می‌گیرد؛ notify هم از طریق
    // versionSignal (effect) و هم direct انجام می‌شود ⇒ حتی اگر cb حین
    // notification بخواند، latest visible است.
    const stateSubscribers = new Set<(state: S) => void>();
    const actionListeners = new Set<(ctx: StoreActionContext<S, G, A>) => void>();
    owned.add(() => { stateSubscribers.clear(); actionListeners.clear(); });

    const notifySubscribers = (): void => {
      if (isDisposed) return;
      for (const cb of [...stateSubscribers]) cb(stateObj as S);
    };

    // triggerReactive: فراخوانی پس از هر mutation.
    const triggerReactive = () => {
      if (isDisposed) return;
      versionSignal.set(versionSignal.get() + 1);
      notifySubscribers();
    };

    // ساخت deep proxy روی همان stateObj.
    const stateProxy = createInPlaceDeepProxy(stateObj, triggerReactive);

    // ── stateSignal: شیء raw state را نگه می‌دارد ──
    // این Signal برای $patch, $reset, و خواندن مستقیم استفاده می‌شود.
    // برای reactive tracking از versionSignal استفاده می‌شود.
    const stateSignal = signal<S>(stateObj); owned.add(stateSignal);

    // ساخت store object.
    const store: Omit<StoreBase<S, G, A>, 'dispose' | '__dispose__'> & Record<PropertyKey, unknown> = {
      $name: id,
      $id: id,
      _signal: stateSignal,
      _versionSignal: versionSignal,
      // state: getter که version را track می‌کند و proxy را برمی‌گرداند.
      // این الگو باعث می‌شود effectهایی که state را می‌خوانند،
      // بعد از هر mutation دوباره اجرا شوند.
      get state(): S {
        // version را track کن (برای reactivity)
        versionSignal.get();
        return stateProxy;
      },
      set state(_v: S) {
        // نمی‌توان کل state را replace کرد. از $patch استفاده کنید.
        // FIX (v1.2.3): قبلاً فقط یک هشدار کنسولی چاپ می‌شد که بی‌سر و صدا
        // نادیده گرفته می‌شد و توسعه‌دهنده متوجه نمی‌شد. حالا throw می‌کند تا
        // خطا زودتر و واضح‌تر دیده شود.
        throw developerError(
          'Cannot reassign store.state. Use $patch() instead.',
          ErrorCode.INTERNAL_DEVELOPER_ERROR,
          { suggestion: 'برای تغییر state از $patch یا اکشن‌ها استفاده کنید.' },
        );
      },
      $reset() {
        // FIX (v1.2.8): P1-2 — Previously $reset only re-wrapped top-level keys
        // in stateObj via createInPlaceDeepProxy. Nested objects that had
        // already been wrapped before $reset retained their old proxies in the
        // global _proxiedSet WeakSet, so a deep mutation after reset on a
        // nested object would NOT trigger triggerReactive (because the proxy
        // was the OLD one whose onMutation closure pointed at the previous
        // store instance / closure variables — and worse, the WeakSet entry
        // meant createInPlaceDeepProxy would short-circuit and return the
        // object as-is, leaving it un-proxied).
        //
        // The fix:
        //   1) Build a fresh state from def.state().
        //   2) Clear stale entries from _proxiedSet for the OLD stateObj's
        //      nested objects (we can't enumerate WeakSet, but we can at
        //      least delete the top-level stateObj entry so it gets re-wrapped
        //      fresh).
        //   3) Wrap the ENTIRE fresh object in place via createInPlaceDeepProxy
        //      (which will recursively wrap nested objects lazily as they are
        //      accessed).
        //   4) Replace all keys of stateObj with the freshly proxied fresh
        //      object's keys (so external references to stateObj remain valid).

        const fresh = def.state();

        // Wrap the entire fresh object in place — createInPlaceDeepProxy
        // recursively wraps nested objects lazily (on first get), so this
        // gives us a fully reactivatable fresh state with NEW proxy entries
        // in _proxiedSet (the OLD nested proxies are no longer reachable
        // through stateObj and will be GC'd from the WeakSet naturally).
        const freshProxy = createInPlaceDeepProxy(fresh, triggerReactive);

        // BUG-STO-03 FIX: Reflect.ownKeys برای پشتیبانی از Symbol-keyed
        // properties در reset.
        // Clear all existing keys from stateObj (in place).
        for (const key of Reflect.ownKeys(stateObj as object)) {
          if (!Reflect.deleteProperty(stateObj as object, key)) throw new TypeError(`Cannot delete store property ${String(key)}.`);
        }

        // BUG-STO-03 FIX: Reflect.ownKeys برای پشتیبانی از Symbol-keyed
        // properties در reset.
        // Copy all keys from the freshly-proxied fresh object into stateObj.
        // We use Reflect.ownKeys on fresh (not freshProxy) to avoid triggering
        // lazy proxy creation during the copy — freshProxy's proxy will be
        // the value that gets assigned, and the lazy nested proxies will
        // kick in when the consumer accesses them.
        for (const key of Reflect.ownKeys(fresh as object)) {
          assignStateKey(stateObj, { key, value: Reflect.get(freshProxy as object, key) });
        }

        stateSignal.set(stateObj);
        triggerReactive();
      },
      // #127 / #145 — اشتراک همگانی state (PersistTarget)؛ cleanup idempotent.
      $subscribe(cb: (state: S) => void, options?: { immediate?: boolean }): () => void {
        if (isDisposed) return () => {};
        stateSubscribers.add(cb);
        if (options?.immediate) {
          cb(stateObj as S);
        }
        let removed = false;
        return () => {
          if (removed) return;
          removed = true;
          stateSubscribers.delete(cb);
        };
      },
      // #127 — اشتراک روی فراخوانی اکشن‌ها با after / onError.
      $onAction(cb: (ctx: StoreActionContext<S, G, A>) => void): () => void {
        if (isDisposed) return () => {};
        actionListeners.add(cb);
        let removed = false;
        return () => {
          if (removed) return;
          removed = true;
          actionListeners.delete(cb);
        };
      },
      // #127 — نصب پلاگین روی این Store.
      use(plugin: StorePlugin<S, G, A>): () => void {
        if (isDisposed) return () => {};
        const cleanup = plugin({ name: id, store: assembledStore(), options: def });
        let cleaned = false;
        const stop = () => {
          if (cleaned) return;
          cleaned = true;
          if (typeof cleanup === 'function') cleanup();
        };
        if (isDisposed) stop(); else owned.add(stop);
        return stop;
      },
      // BUG-STO-03 FIX: Reflect.ownKeys برای پشتیبانی از Symbol-keyed properties.
      $patch(partial: Partial<S>) {
        // FIX (v1.2.9): BUG-05 — Deep merge for nested objects (was shallow only).
        // For nested plain objects, recursively merge instead of replacing wholesale.
        for (const key of Reflect.ownKeys(partial as object)) {
          if (!isSafeStateKey(key)) continue;
          const value: unknown = Reflect.get(partial as object, key);
          const existing: unknown = Reflect.get(stateObj as object, key);
          if (
            isPlainStateObject(existing) && isPlainStateObject(value)
          ) {
            // FIX (v1.2.9): Deep merge — recursively merge nested plain objects
            const merged = deepMerge(existing, value);
            assignStateKey(stateObj, { key, value: createInPlaceDeepProxy(merged, triggerReactive) });
          } else {
            assignStateKey(stateObj, { key, value:
              value !== null && typeof value === 'object'
                ? createInPlaceDeepProxy(value, triggerReactive)
                : value });
          }
        }
        stateSignal.set(stateObj);
        triggerReactive();
      },
    };


    // This assembly assertion is private and occurs only after member installation;
    // it does not manufacture a writable Signal<unknown> for heterogeneous storage.
    function assembledStore(): Store<S, G, A> { return store as Store<S, G, A>; }

    // ساخت getters (computed).
    // هر getter هم versionSignal را track می‌کند (تا بعد از mutation دوباره اجرا شود)
    // و هم stateObj را می‌خواند (که in place mutated شده).
    if (def.getters) {
      for (const [name, getter] of Object.entries(def.getters)) {
        const c = computed(() => {
          versionSignal.get(); // track version برای reactivity
          return Reflect.apply(getter, undefined, [stateObj]) as unknown;
        });
        store[name] = c;
        owned.add(c);
      }
    }

    // ساخت actions.
    if (def.actions) {
      for (const [name, action] of Object.entries(def.actions)) {
        store[name] = (...args: unknown[]) => {
          const afterCbs: Array<(res: unknown) => void> = [];
          const errorCbs: Array<(err: unknown) => void> = [];
          for (const listener of [...actionListeners]) {
            listener({
              name,
              store: assembledStore(),
              args,
              after: (fn) => afterCbs.push(fn),
              onError: (fn) => errorCbs.push(fn),
            });
          }

          const ctx = {
            state: stateProxy,
            getters: new Proxy(store, {
              get: (t, p) => {
                const v: unknown = Reflect.get(t, p);
                return v && typeof Reflect.get(Object(v), 'get') === 'function' ? Reflect.apply(Reflect.get(Object(v), 'get'), v, []) : v;
              },
            }),
            actions: store,
          };
          try {
            const res: unknown = Reflect.apply(action, ctx, args);
            if (res && typeof Reflect.get(Object(res), 'then') === 'function') {
              return Reflect.apply(Reflect.get(Object(res), 'then'), res, [
                (resolved: unknown) => {
                  for (const fn of afterCbs) fn(resolved);
                  return resolved;
                },
                (err: unknown) => {
                  for (const fn of errorCbs) fn(err);
                  throw err;
                },
              ]);
            }
            for (const fn of afterCbs) fn(res);
            return res;
          } catch (err) {
            for (const fn of errorCbs) fn(err);
            throw err;
          }
        };
      }
    }

    const disposeStore = () => {
      if (isDisposed) return;
      isDisposed = true;
      releaseRegistration();
      stateSubscribers.clear();
      actionListeners.clear();
      owned.dispose();
    };

    store.__dispose__ = disposeStore;
    store.dispose = disposeStore;
    const disposeSymbol: unknown = typeof Symbol !== 'undefined' ? Reflect.get(Symbol, 'dispose') : undefined;
    if (typeof disposeSymbol === 'symbol') store[disposeSymbol] = disposeStore;

    setStoreOwner(store);
    if (def.persist) {
      const persistOpts = typeof def.persist === 'object' ? def.persist : {};
      owned.add(persistStore<S, G, A>(assembledStore(), persistOpts));
    }

    for (const globalPlugin of storePluginsFor()) {
      Reflect.apply(Reflect.get(store, 'use'), store, [globalPlugin]);
    }

    try { releaseRegistration = storeRegistry.register(id, assembledStore()); } catch (error) { disposeStore(); throw error; }
    storeRegistry.own(disposeStore);
    return assembledStore();
    } catch (error) { isDisposed = true; releaseRegistration(); try { owned.dispose(); } catch { /* preserve construction failure */ } throw error; }
  };
}

