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
  /** __dispose__: پاکسازی computed signals. */
  __dispose__(): void;
} & { [K in keyof G]: G[K] extends (s: any) => infer R ? R : never }
  & { [K in keyof A]: A[K] };

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
      sVal !== null && typeof sVal === 'object' && !Array.isArray(sVal) &&
      tVal !== null && typeof tVal === 'object' && !Array.isArray(tVal)
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
function createInPlaceDeepProxy<T>(obj: T, onMutation: () => void, _visitingSet?: WeakSet<object>): T {
  if (obj === null || typeof obj !== 'object') return obj;

  const visitingSet = _visitingSet || new WeakSet<object>();
  if (visitingSet.has(obj)) return obj;  // circular → return as-is
  visitingSet.add(obj);

  // Array ها: intercept mutating methods + set
  if (Array.isArray(obj)) {
    const mutatingMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'];
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
        const wrapped = (value !== null && typeof value === 'object')
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
      const wrapped = (value !== null && typeof value === 'object')
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
export function defineStore<S, G extends Record<string, (state: S) => any>, A extends Record<string, Function>>(
  id: string,
  def: StoreDefinition<S, G, A>,
): () => Store<S, G, A> {
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

    // triggerReactive: فراخوانی پس از هر mutation.
    const triggerReactive = () => {
      versionSignal.set(versionSignal.get() + 1);
    };

    // ساخت deep proxy روی همان stateObj.
    const stateProxy = createInPlaceDeepProxy(stateObj, triggerReactive);

    // ── stateSignal: شیء raw state را نگه می‌دارد ──
    // این Signal برای $patch, $reset, و خواندن مستقیم استفاده می‌شود.
    // برای reactive tracking از versionSignal استفاده می‌شود.
    const stateSignal = signal<S>(stateObj);

    // ساخت store object.
    const store: any = {
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
        // FIX (v1.2.3): قبلاً فقط console.warn چاپ می‌شد که بی‌سر و صدا نادیده
        // گرفته می‌شد و توسعه‌دهنده متوجه نمی‌شد. حالا throw می‌کند تا خطا
        // زودتر و واضح‌تر دیده شود.
        throw new Error('[Zenith Store] Cannot reassign store.state. Use $patch() instead.');
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
      // BUG-STO-03 FIX: Reflect.ownKeys برای پشتیبانی از Symbol-keyed properties.
      $patch(partial: Partial<S>) {
        // FIX (v1.2.9): BUG-05 — Deep merge for nested objects (was shallow only).
        // For nested plain objects, recursively merge instead of replacing wholesale.
        for (const key of Reflect.ownKeys(partial as any)) {
          const value = (partial as any)[key];
          const existing = (stateObj as any)[key];
          if (existing && typeof existing === 'object' && !Array.isArray(existing)
              && value && typeof value === 'object' && !Array.isArray(value)) {
            // FIX (v1.2.9): Deep merge — recursively merge nested plain objects
            const merged = deepMerge(existing, value);
            (stateObj as any)[key] = createInPlaceDeepProxy(merged, triggerReactive);
          } else {
            (stateObj as any)[key] = (value !== null && typeof value === 'object')
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
          versionSignal.get();  // track version برای reactivity
          return (getter as Function)(stateObj);
        });
        store[name] = c;
        computedDisposables.push(() => c.dispose());
      }
    }

    // ساخت actions.
    if (def.actions) {
      for (const [name, action] of Object.entries(def.actions)) {
        store[name] = (...args: any[]) => {
          // context برای action.
          // FIX (v1.2.3): getters در context اکنون یک Proxy است که Computed
          // objects را به‌طور خودکار unwrap می‌کند (با صدا زدن .get()). قبلاً
          // getters خام (Computed objects) به action می‌رسیدند و توسعه‌دهنده
          // باید دستی `.get()` صدا می‌زد — که مستعد خطا بود و کاملاً با
          // تعریف StoreContext (که R را برمی‌گرداند) سازگار نبود.
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
          return (action as Function).apply(ctx, args);
        };
      }
    }

    (store as any).__dispose__ = () => {
      // FIX (v1.2.3): store را از storeRegistry حذف کن تا در صورت تعریف
      // مجدد با همان id، store قدیمی (که disposed شده) برنگردد.
      storeRegistry.delete(id);
      computedDisposables.forEach(d => d());
    };

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

/**
 * پاکسازی همه‌ی store ها (برای تست‌ها).
 */
export function clearStores(): void {
  for (const store of storeRegistry.values()) {
    (store as any).__dispose__?.();
  }
  storeRegistry.clear();
}
