// packages/store/src/store.ts
//
// @zenith/store — Global state management (Phase 3).
//
// مشابه Pinia (Vue) اما برای Zenith. یک Store یک شیء reactive است که:
//   - state را در Signal نگه می‌دارد.
//   - getters (computed) را فراهم می‌کxند.
//   - actions (methods) را دارد.
//   - بین کامپوننت‌ها به اشتراک گذاشته می‌شود.
//
// ── سینتکس ──
//
//   const useUserStore = defineStore('user', {
//     state: () => ({
//       name: '',
//       age: 0,
//       preferences: { theme: 'light' }
//     }),
//     getters: {
//       fullName: (state) => state.name,
//       isAdult: (state) => state.age >= 18,
//     },
//     actions: {
//       setName(name: string) {
//         this.state.name = name;
//       },
//       async fetchUser(id: number) {
//         const res = await fetch(`/api/users/${id}`);
//         const data = await res.json();
//         this.state.name = data.name;
//         this.state.age = data.age;
//       }
//     }
//   });
//
//   // استفاده در کامپوننت:
//   const store = useUserStore();
//   store.state.name = 'Ali';  // reactive (deep proxy triggers version bump)
//   store.setName('Reza');    // action
//   store.isAdult;             // getter (computed)
//
// ── Bug Fix (test-batch-C) ──
//
// قبلاً deep proxy یک شیء جدید (proxied) می‌ساخت و آن را mutate می‌کرد.
// اما Signal همچنان شیء اصلی را نگه می‌داشت. پس mutations هرگز به Signal
// نمی‌رسیدند و getters همیشه مقدار اولیه را برمی‌گرداندند.
//
// راه‌حل: state در یک raw object ذخیره می‌شود که proxy آن را IN PLACE
// mutate می‌کند. یک versionSignal جداگانه برای reactive tracking استفاده
// می‌شود. هر mutation، version را increment می‌کند و subscribers را trigger.
// این الگو شبیه به Vue 3 reactivity است.

import { signal, computed, type Signal } from '@zenith/state';
import { developerError, ErrorCode } from '@zenith/errors';

/**
 * #127: گزینه‌های ذخیره‌سازی پایدار Store (`persistStore`).
 */
export interface StorePersistStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface StorePersistOptions<S = any> {
  key?: string;
  storage?: StorePersistStorage;
  version?: number;
  migrate?: (persistedState: any, oldVersion: number) => S;
  pick?: Array<keyof S & string>;
  omit?: Array<keyof S & string>;
}

export interface StoreActionContext<S = any, G = any, A = any> {
  name: string;
  store: Store<S, G, A>;
  args: unknown[];
  after: (cb: (result: unknown) => void) => void;
  onError: (cb: (error: unknown) => void) => void;
}

export type StorePlugin<S = any, G = any, A = any> = (context: {
  name: string;
  store: Store<S, G, A>;
  options: StoreDefinition<S, G, A>;
}) => void | (() => void);

/**
 * تعریف یک Store.
 */
export interface StoreDefinition<S, G, A> {
  /** تابع بازگرداندن state اولیه. */
  state: () => S;
  /** Getter ها (computed values). */
  getters?: G & ThisType<StoreContext<S, G, A>>;
  /** Action ها (methods). */
  actions?: A & ThisType<StoreContext<S, G, A>>;
  /** #127: پیکربندی اختیاری ذخیره‌سازی پایدار (persist). */
  persist?: boolean | StorePersistOptions<S>;
}

/**
 * Context که در getters و actions در دسترس است.
 */
export interface StoreContext<S, G, A> {
  /** State reactive. */
  state: S;
  /** Getter ها. */
  getters: { [K in keyof G]: G[K] extends (s: any) => infer R ? R : never };
  /** Action ها. */
  actions: A;
}

/**
 * نوع یک Store ساخته‌شده.
 *
 * نکته: getters به‌صورت Computed objects هستند (نه unwrapped values).
 * برای خواندن مقدار: `store.<getter>.get()`.
 */
export type Store<S, G, A> = {
  /** نام یکتای Store در رجیستری (#118 / #127). */
  readonly $name: string;
  /** شناسهٔ Store (سازگار با نسخهٔ قبلی). */
  readonly $id: string;
  /** Signal زیرین state (آبجکت raw). */
  _signal: Signal<S>;
  /** Signal شماره نسخه (هر mutation یک increment). */
  _versionSignal: Signal<number>;
  /** State reactive (می‌توان مستقیماً خواند/نوشت). */
  state: S;
  /** $reset: بازگرداندن state به مقدار اولیه. */
  $reset(): void;
  /** $patch: اعمال patch partial روی state. */
  $patch(partial: Partial<S>): void;
  /** #127 / #145 — اشتراک تغییرات state → Cleanup. */
  $subscribe(cb: (state: S) => void, options?: { immediate?: boolean }): () => void;
  /** #127 — اشتراک روی فراخوانی اکشن‌ها → Cleanup. */
  $onAction(cb: (ctx: StoreActionContext<S, G, A>) => void): () => void;
  /** #127 — نصب پلاگین روی این Store → Cleanup. */
  use(plugin: StorePlugin<S, G, A>): () => void;
  /** پاکسازی کامل Store و اشتراک‌های آن. */
  dispose(): void;
  /** __dispose__: پاکسازی computed signals. */
  __dispose__(): void;
} & { [K in keyof G]: G[K] extends (s: any) => infer R ? R : never } & { [K in keyof A]: A[K] };

const _globalStorePlugins = new Set<StorePlugin<any, any, any>>();
const _fallbackMemoryStorage = new Map<string, string>();
const defaultMemoryStorage: StorePersistStorage = {
  getItem: (k) => _fallbackMemoryStorage.get(k) ?? null,
  setItem: (k, v) => void _fallbackMemoryStorage.set(k, v),
  removeItem: (k) => void _fallbackMemoryStorage.delete(k),
};

function resolvePersistStorage(custom?: StorePersistStorage): StorePersistStorage {
  if (custom) return custom;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage as StorePersistStorage;
    }
  } catch {
    // ignore SecurityError
  }
  return defaultMemoryStorage;
}

/**
 * #127: ثبت پلاگین سراسری برای همهٔ Storeها.
 */
export function useStorePlugin(plugin: StorePlugin<any, any, any>): () => void {
  _globalStorePlugins.add(plugin);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    _globalStorePlugins.delete(plugin);
  };
}

/**
 * #127: ذخیره‌سازی پایدار و بازیابی خودکار وضعیت Store با پشتیبانی از `version`/`migrate` و `pick`/`omit`.
 */
export function persistStore<S = any, G = any, A = any>(
  store: Store<S, G, A>,
  options: StorePersistOptions<S> = {},
): () => void {
  const storage = resolvePersistStorage(options.storage);
  const key = options.key ?? `zenith:store:${store.$name || 'default'}`;
  const version = options.version ?? 1;

  const filterState = (raw: S): Partial<S> => {
    if (!raw || typeof raw !== 'object') return raw;
    if (options.pick && options.pick.length > 0) {
      const picked: Partial<S> = {};
      for (const k of options.pick) {
        if (k in raw) picked[k] = raw[k];
      }
      return picked;
    }
    if (options.omit && options.omit.length > 0) {
      const omitSet = new Set<string>(options.omit);
      const copy: Partial<S> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (!omitSet.has(k)) (copy as any)[k] = v;
      }
      return copy;
    }
    return { ...raw };
  };

  // بازیابی اولیه از storage
  try {
    const rawStr = storage.getItem(key);
    if (rawStr) {
      const parsed = JSON.parse(rawStr);
      let restoredState: any =
        parsed && typeof parsed === 'object' && '__zenithVersion' in parsed ? parsed.state : parsed;
      const persistedVersion =
        parsed && typeof parsed === 'object' && typeof parsed.__zenithVersion === 'number'
          ? parsed.__zenithVersion
          : 0;
      if (persistedVersion !== version && typeof options.migrate === 'function') {
        restoredState = options.migrate(restoredState, persistedVersion);
      }
      if (restoredState && typeof restoredState === 'object') {
        store.$patch(filterState(restoredState as S));
      }
    }
  } catch {
    // ignore corrupt persisted JSON
  }

  return store.$subscribe((currentState) => {
    try {
      const payload = JSON.stringify({
        __zenithVersion: version,
        state: filterState(currentState),
      });
      storage.setItem(key, payload);
    } catch {
      // ignore quota errors
    }
  });
}

/**
 * Registry از store ها.
 */
const storeRegistry = new Map<string, Store<any, any, any>>();

// FIX (v1.2.9): BUG-05 — Deep merge helper for $patch.
// Recursively merges nested plain objects (not arrays or class instances).
// BUG-STO-02 FIX: depth limit (=10) برای جلوگیری از stack overflow روی
// اشیای عمیق.
// BUG-STO-03 FIX: Reflect.ownKeys به‌جای Object.keys برای پشتیبانی از
// Symbol-keyed properties.
const DEEP_MERGE_MAX_DEPTH = 10;
function deepMerge<T>(target: T, source: Partial<T>, _depth = 0): T {
  const result = { ...target } as any;
  if (_depth >= DEEP_MERGE_MAX_DEPTH) return result;
  for (const key of Reflect.ownKeys(source as any)) {
    const sVal = (source as any)[key];
    const tVal = (result as any)[key];
    if (
      sVal !== null &&
      typeof sVal === 'object' &&
      !Array.isArray(sVal) &&
      tVal !== null &&
      typeof tVal === 'object' &&
      !Array.isArray(tVal)
    ) {
      result[key] = deepMerge(tVal, sVal, _depth + 1);
    } else {
      result[key] = sVal;
    }
  }
  return result;
}

/**
 * ساخت deep proxy که شیء ورودی را IN PLACE mutate می‌کند.
 *
 * این تابع یک شیء جدید نمی‌سازد، بلکه روی همان شیء ورودی Proxy می‌گذارد.
 * وقتی هر property (تو در تو) set شود، onMutation صدا زده می‌شود.
 *
 * نکته: Proxy فقط روی ساختار شیء ورودی اعمال می‌شود، نه روی clone.
 * پس mutation از طریق proxy، شیء اصلی را تغییر می‌دهد.
 *
 * @param obj شیء اصلی که باید proxy شود (در Place mutate می‌شود).
 * @param onMutation تابع callback برای فراخوانی پس از هر mutation.
 */
/**
 * BUG-9 FIX (v1.2.2): WeakSet سراسری برای ردیابی آبجکت‌هایی که از قبل proxy
 * شده‌اند. این کار از re-wrap مکرر عناصر آرایه جلوگیری می‌کند و complexity
 * mutating methods را از O(n²) به O(new_elements) کاهش می‌دهد.
 */
const _proxiedSet = new WeakSet<object>();

// BUG-STO-01 FIX: Local WeakSet برای تشخیص circular references در
// زمان ساخت proxy. هر فراخوانی سطح بالا یک visitingSet می‌سازد و آن را
// به فراخوانی‌های بازگشتی پاس می‌دهد. اگر دوباره به همان آبجکت برسیم
// (مثلاً obj.self = obj)، از stack overflow جلوگیری می‌کند.
function createInPlaceDeepProxy<T>(
  obj: T,
  onMutation: () => void,
  _visitingSet?: WeakSet<object>,
): T {
  if (obj === null || typeof obj !== 'object') return obj;

  const visitingSet = _visitingSet || new WeakSet<object>();
  if (visitingSet.has(obj)) return obj; // circular → return as-is
  visitingSet.add(obj);

  // Array ها: intercept mutating methods + set
  if (Array.isArray(obj)) {
    const mutatingMethods = [
      'push',
      'pop',
      'shift',
      'unshift',
      'splice',
      'sort',
      'reverse',
      'fill',
      'copyWithin',
    ];
    return new Proxy(obj as any, {
      get(target: any, prop: string, receiver: any) {
        // mutating methods را intercept کن
        if (mutatingMethods.includes(prop)) {
          return (...args: any[]) => {
            const result = Array.prototype[prop as any].apply(target, args);
            // BUG-9 FIX (v1.2.2): فقط عناصر جدید (not-yet-proxied) را wrap کن.
            // قبلاً تمام عناصر در هر mutating call دوباره wrap می‌شدند (O(n) per
            // call، که در m عملیات متوالی به O(n*m) می‌شد). حالا با استفاده از
            // _proxiedSet سراسری، فقط عناصری که هنوز proxy نشده‌اند wrap
            // می‌شوند — یعنی O(new_elements) به‌جای O(n).
            for (let i = 0; i < target.length; i++) {
              const elem = target[i];
              if (elem !== null && typeof elem === 'object' && !_proxiedSet.has(elem)) {
                const proxied = createInPlaceDeepProxy(elem, onMutation, visitingSet);
                target[i] = proxied;
                _proxiedSet.add(proxied);
              }
            }
            onMutation();
            return result;
          };
        }
        // indexed access به عناصر: proxy برگردان
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const v = target[prop];
          if (v !== null && typeof v === 'object' && !_proxiedSet.has(v)) {
            const proxied = createInPlaceDeepProxy(v, onMutation, visitingSet);
            target[prop] = proxied;
            _proxiedSet.add(proxied);
            return proxied;
          }
          return v;
        }
        return Reflect.get(target, prop, receiver);
      },
      set(target: any, prop: string, value: any) {
        const wrapped =
          value !== null && typeof value === 'object'
            ? createInPlaceDeepProxy(value, onMutation, visitingSet)
            : value;
        if (wrapped !== null && typeof wrapped === 'object') _proxiedSet.add(wrapped);
        (target as any)[prop] = wrapped;
        onMutation();
        return true;
      },
      deleteProperty(target: any, prop: string) {
        delete (target as any)[prop];
        onMutation();
        return true;
      },
    }) as T;
  }

  // Object ها: intercept set + get (برای nested)
  return new Proxy(obj as any, {
    set(target: any, prop: string, value: any) {
      const wrapped =
        value !== null && typeof value === 'object'
          ? createInPlaceDeepProxy(value, onMutation, visitingSet)
          : value;
      if (wrapped !== null && typeof wrapped === 'object') _proxiedSet.add(wrapped);
      (target as any)[prop] = wrapped;
      onMutation();
      return true;
    },
    get(target: any, prop: string, receiver: any) {
      const v = Reflect.get(target, prop, receiver);
      if (v !== null && typeof v === 'object' && !_proxiedSet.has(v)) {
        // nested object را هم proxy کن (lazy)
        const proxied = createInPlaceDeepProxy(v, onMutation, visitingSet);
        (target as any)[prop] = proxied;
        _proxiedSet.add(proxied);
        return proxied;
      }
      return v;
    },
    deleteProperty(target: any, prop: string) {
      delete (target as any)[prop];
      onMutation();
      return true;
    },
  }) as T;
}

/**
 * تعریف یک Store.
 *
 * @param id   شناسه‌ی یکتای store.
 * @param def  تعریف store (state, getters, actions).
 * @returns تابع استفاده از store.
 */
export function defineStore<
  S,
  G extends Record<string, (state: S) => any>,
  A extends Record<string, Function>,
>(id: string, def: StoreDefinition<S, G, A>): () => Store<S, G, A> {
  return () => {
    // اگر قبلاً ساخته شده، همان را برگردان.
    if (storeRegistry.has(id)) {
      return storeRegistry.get(id) as Store<S, G, A>;
    }

    // ── State: raw object که proxy آن را IN PLACE mutate می‌کند ──
    const stateObj = def.state();

    // versionSignal: هر mutation یک increment می‌کند. این Signal توسط
    // getterهای reactive و effectهای وابسته track می‌شود.
    const versionSignal = signal<number>(0);

    // #145 — اشتراک همگانی state (PersistTarget در @zenith/storage):
    // cb همان stateObj (in-place) را می‌گیرد؛ notify هم از طریق
    // versionSignal (effect) و هم direct انجام می‌شود ⇒ حتی اگر cb حین
    // notification بخواند، latest visible است.
    const stateSubscribers = new Set<(state: S) => void>();
    const actionListeners = new Set<(ctx: StoreActionContext<S, G, A>) => void>();
    const pluginCleanups: Array<() => void> = [];
    let isDisposed = false;

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
    const stateSignal = signal<S>(stateObj);

    // ساخت store object.
    const store: any = {
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
        for (const key of Reflect.ownKeys(stateObj as any)) {
          delete (stateObj as any)[key];
        }

        // BUG-STO-03 FIX: Reflect.ownKeys برای پشتیبانی از Symbol-keyed
        // properties در reset.
        // Copy all keys from the freshly-proxied fresh object into stateObj.
        // We use Reflect.ownKeys on fresh (not freshProxy) to avoid triggering
        // lazy proxy creation during the copy — freshProxy's proxy will be
        // the value that gets assigned, and the lazy nested proxies will
        // kick in when the consumer accesses them.
        for (const key of Reflect.ownKeys(fresh as any)) {
          (stateObj as any)[key] = (freshProxy as any)[key];
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
        const cleanup = plugin({ name: id, store, options: def });
        let cleaned = false;
        const stop = () => {
          if (cleaned) return;
          cleaned = true;
          if (typeof cleanup === 'function') cleanup();
        };
        pluginCleanups.push(stop);
        return stop;
      },
      // BUG-STO-03 FIX: Reflect.ownKeys برای پشتیبانی از Symbol-keyed properties.
      $patch(partial: Partial<S>) {
        // FIX (v1.2.9): BUG-05 — Deep merge for nested objects (was shallow only).
        // For nested plain objects, recursively merge instead of replacing wholesale.
        for (const key of Reflect.ownKeys(partial as any)) {
          const value = (partial as any)[key];
          const existing = (stateObj as any)[key];
          if (
            existing &&
            typeof existing === 'object' &&
            !Array.isArray(existing) &&
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ) {
            // FIX (v1.2.9): Deep merge — recursively merge nested plain objects
            const merged = deepMerge(existing, value);
            (stateObj as any)[key] = createInPlaceDeepProxy(merged, triggerReactive);
          } else {
            (stateObj as any)[key] =
              value !== null && typeof value === 'object'
                ? createInPlaceDeepProxy(value, triggerReactive)
                : value;
          }
        }
        stateSignal.set(stateObj);
        triggerReactive();
      },
    };

    const computedDisposables: (() => void)[] = [];

    // ساخت getters (computed).
    // هر getter هم versionSignal را track می‌کند (تا بعد از mutation دوباره اجرا شود)
    // و هم stateObj را می‌خواند (که in place mutated شده).
    if (def.getters) {
      for (const [name, getter] of Object.entries(def.getters)) {
        const c = computed(() => {
          versionSignal.get(); // track version برای reactivity
          return (getter as Function)(stateObj);
        });
        store[name] = c;
        computedDisposables.push(() => c.dispose?.());
      }
    }

    // ساخت actions.
    if (def.actions) {
      for (const [name, action] of Object.entries(def.actions)) {
        store[name] = (...args: any[]) => {
          const afterCbs: Array<(res: unknown) => void> = [];
          const errorCbs: Array<(err: unknown) => void> = [];
          for (const listener of [...actionListeners]) {
            listener({
              name,
              store,
              args,
              after: (fn) => afterCbs.push(fn),
              onError: (fn) => errorCbs.push(fn),
            });
          }

          const ctx: any = {
            state: stateProxy,
            getters: new Proxy(store, {
              get: (t, p) => {
                const v = (t as any)[p];
                return v && typeof v.get === 'function' ? v.get() : v;
              },
            }),
            actions: store,
          };
          try {
            const res = (action as Function).apply(ctx, args);
            if (res && typeof (res as Promise<unknown>).then === 'function') {
              return (res as Promise<unknown>).then(
                (resolved) => {
                  for (const fn of afterCbs) fn(resolved);
                  return resolved;
                },
                (err) => {
                  for (const fn of errorCbs) fn(err);
                  throw err;
                },
              );
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
      storeRegistry.delete(id);
      stateSubscribers.clear();
      actionListeners.clear();
      pluginCleanups.forEach((d) => d());
      computedDisposables.forEach((d) => d());
    };

    (store as any).__dispose__ = disposeStore;
    (store as any).dispose = disposeStore;
    if (typeof Symbol !== 'undefined' && (Symbol as any).dispose) {
      (store as any)[(Symbol as any).dispose] = disposeStore;
    }

    if (def.persist) {
      const persistOpts = typeof def.persist === 'object' ? def.persist : {};
      pluginCleanups.push(persistStore(store, persistOpts));
    }

    for (const globalPlugin of _globalStorePlugins) {
      store.use(globalPlugin);
    }

    storeRegistry.set(id, store);
    return store as Store<S, G, A>;
  };
}

/**
 * دریافت یک store با ID.
 */
export function getStore(id: string): Store<any, any, any> | undefined {
  return storeRegistry.get(id);
}

/** #118: ثبت مستقیم Store در رجیستری با بازگشت Cleanup idempotent. */
export function registerStore(name: string, store: Store<any, any, any>): () => void {
  storeRegistry.set(name, store);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (storeRegistry.get(name) === store) {
      storeRegistry.delete(name);
    }
  };
}

/** #118: بررسی وجود Store ثبت‌شده (`hasX`). */
export function hasStore(name: string): boolean {
  return storeRegistry.has(name);
}

/** #118: فهرست نام تمام Storeهای ثبت‌شده (`listXs`). */
export function listStores(): string[] {
  return Array.from(storeRegistry.keys());
}

/** #118: حذف یک Store با نام از رجیستری (`unregisterX`). */
export function unregisterStore(name: string): boolean {
  const existing = storeRegistry.get(name);
  if (!existing) return false;
  (existing as any).__dispose__?.();
  storeRegistry.delete(name);
  return true;
}

/**
 * پاکسازی همه‌ی store ها (برای تست‌ها).
 */
export function clearStores(): void {
  for (const store of storeRegistry.values()) {
    (store as any).__dispose__?.();
  }
  storeRegistry.clear();
}
