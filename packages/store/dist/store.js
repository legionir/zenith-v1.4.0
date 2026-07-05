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
import { signal, computed } from '@zenith/state';
/**
 * Registry از store ها.
 */
const storeRegistry = new Map();
// FIX (v1.2.9): BUG-05 — Deep merge helper for $patch.
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const sVal = source[key];
        const tVal = result[key];
        if (sVal !== null && typeof sVal === 'object' && !Array.isArray(sVal)
            && tVal !== null && typeof tVal === 'object' && !Array.isArray(tVal)) {
            result[key] = deepMerge(tVal, sVal);
        }
        else {
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
 * شده‌اند. این کار از re-wrap مکرر عناصر آرایه جلوگیری می‌کند.
 */
const _proxiedSet = new WeakSet();

function createInPlaceDeepProxy(obj, onMutation) {
    if (obj === null || typeof obj !== 'object')
        return obj;
    // Array ها: intercept mutating methods + set
    if (Array.isArray(obj)) {
        const mutatingMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'];
        return new Proxy(obj, {
            get(target, prop, receiver) {
                // mutating methods را intercept کن
                if (mutatingMethods.includes(prop)) {
                    return (...args) => {
                        const result = Array.prototype[prop].apply(target, args);
                        // BUG-9 FIX (v1.2.2): فقط عناصر جدید (not-yet-proxied) را wrap کن.
                        for (let i = 0; i < target.length; i++) {
                            const elem = target[i];
                            if (elem !== null && typeof elem === 'object' && !_proxiedSet.has(elem)) {
                                const proxied = createInPlaceDeepProxy(elem, onMutation);
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
                        const proxied = createInPlaceDeepProxy(v, onMutation);
                        target[prop] = proxied;
                        _proxiedSet.add(proxied);
                        return proxied;
                    }
                    return v;
                }
                return Reflect.get(target, prop, receiver);
            },
            set(target, prop, value) {
                const wrapped = (value !== null && typeof value === 'object')
                    ? createInPlaceDeepProxy(value, onMutation)
                    : value;
                if (wrapped !== null && typeof wrapped === 'object') _proxiedSet.add(wrapped);
                target[prop] = wrapped;
                onMutation();
                return true;
            },
            deleteProperty(target, prop) {
                delete target[prop];
                onMutation();
                return true;
            },
        });
    }
    // Object ها: intercept set + get (برای nested)
    return new Proxy(obj, {
        set(target, prop, value) {
            const wrapped = (value !== null && typeof value === 'object')
                ? createInPlaceDeepProxy(value, onMutation)
                : value;
            if (wrapped !== null && typeof wrapped === 'object') _proxiedSet.add(wrapped);
            target[prop] = wrapped;
            onMutation();
            return true;
        },
        get(target, prop, receiver) {
            const v = Reflect.get(target, prop, receiver);
            if (v !== null && typeof v === 'object' && !_proxiedSet.has(v)) {
                // nested object را هم proxy کن (lazy)
                const proxied = createInPlaceDeepProxy(v, onMutation);
                target[prop] = proxied;
                _proxiedSet.add(proxied);
                return proxied;
            }
            return v;
        },
        deleteProperty(target, prop) {
            delete target[prop];
            onMutation();
            return true;
        },
    });
}
/**
 * تعریف یک Store.
 *
 * @param id   شناسه‌ی یکتای store.
 * @param def  تعریف store (state, getters, actions).
 * @returns تابع استفاده از store.
 */
export function defineStore(id, def) {
    return () => {
        // اگر قبلاً ساخته شده، همان را برگردان.
        if (storeRegistry.has(id)) {
            return storeRegistry.get(id);
        }
        // ── State: raw object که proxy آن را IN PLACE mutate می‌کند ──
        const stateObj = def.state();
        // versionSignal: هر mutation یک increment می‌کند. این Signal توسط
        // getterهای reactive و effectهای وابسته track می‌شود.
        const versionSignal = signal(0);
        // triggerReactive: فراخوانی پس از هر mutation.
        const triggerReactive = () => {
            versionSignal.set(versionSignal.get() + 1);
        };
        // ساخت deep proxy روی همان stateObj.
        const stateProxy = createInPlaceDeepProxy(stateObj, triggerReactive);
        // ── stateSignal: شیء raw state را نگه می‌دارد ──
        // این Signal برای $patch, $reset, و خواندن مستقیم استفاده می‌شود.
        // برای reactive tracking از versionSignal استفاده می‌شود.
        const stateSignal = signal(stateObj);
        // ساخت store object.
        const store = {
            _signal: stateSignal,
            _versionSignal: versionSignal,
            // state: getter که version را track می‌کند و proxy را برمی‌گرداند.
            // این الگو باعث می‌شود effectهایی که state را می‌خوانند،
            // بعد از هر mutation دوباره اجرا شوند.
            get state() {
                // version را track کن (برای reactivity)
                versionSignal.get();
                return stateProxy;
            },
            set state(_v) {
                // نمی‌توان کل state را replace کرد. از $patch استفاده کنید.
                // FIX (v1.2.3): قبلاً فقط console.warn چاپ می‌شد — حالا throw می‌کند.
                throw new Error('[Zenith Store] Cannot reassign store.state. Use $patch() instead.');
            },
            $reset() {
                // FIX (v1.2.8): P1-2 — Previously $reset only re-wrapped top-level
                // keys in stateObj via createInPlaceDeepProxy. Nested objects that
                // had already been wrapped before $reset retained their old proxies
                // in the global _proxiedSet WeakSet, so a deep mutation after
                // reset on a nested object would NOT trigger triggerReactive (the
                // WeakSet short-circuit meant createInPlaceDeepProxy returned the
                // object as-is, leaving it un-proxied with the wrong onMutation).
                //
                // The fix: build a fresh state, wrap the ENTIRE fresh object in
                // place via createInPlaceDeepProxy (which recursively wraps nested
                // objects lazily as they are accessed), then copy all keys into
                // stateObj. The OLD nested proxies are no longer reachable through
                // stateObj and will be GC'd from the WeakSet naturally.
                const fresh = def.state();
                // Wrap the entire fresh object in place — recursive lazy wrapping
                // gives us NEW proxy entries in _proxiedSet.
                const freshProxy = createInPlaceDeepProxy(fresh, triggerReactive);
                // Clear all existing keys from stateObj (in place).
                for (const key of Object.keys(stateObj)) {
                    delete stateObj[key];
                }
                // Copy all keys from the freshly-proxied fresh object into stateObj.
                for (const key of Object.keys(fresh)) {
                    stateObj[key] = freshProxy[key];
                }
                stateSignal.set(stateObj);
                triggerReactive();
            },
            $patch(partial) {
                // FIX (v1.2.9): BUG-05 — Deep merge for nested objects (was shallow only).
                for (const key of Object.keys(partial)) {
                    const value = partial[key];
                    const existing = stateObj[key];
                    if (existing && typeof existing === 'object' && !Array.isArray(existing)
                        && value && typeof value === 'object' && !Array.isArray(value)) {
                        const merged = deepMerge(existing, value);
                        stateObj[key] = createInPlaceDeepProxy(merged, triggerReactive);
                    }
                    else {
                        stateObj[key] = (value !== null && typeof value === 'object')
                            ? createInPlaceDeepProxy(value, triggerReactive)
                            : value;
                    }
                }
                stateSignal.set(stateObj);
                triggerReactive();
            },
        };
        const computedDisposables = [];
        // ساخت getters (computed).
        // هر getter هم versionSignal را track می‌کند (تا بعد از mutation دوباره اجرا شود)
        // و هم stateObj را می‌خواند (که in place mutated شده).
        if (def.getters) {
            for (const [name, getter] of Object.entries(def.getters)) {
                const c = computed(() => {
                    versionSignal.get(); // track version برای reactivity
                    return getter(stateObj);
                });
                store[name] = c;
                computedDisposables.push(() => c.dispose());
            }
        }
        // ساخت actions.
        if (def.actions) {
            for (const [name, action] of Object.entries(def.actions)) {
                store[name] = (...args) => {
                    // context برای action.
                    // FIX (v1.2.3): getters در context اکنون یک Proxy است که
                    // Computed objects را به‌طور خودکار unwrap می‌کند (.get()).
                    const ctx = {
                        state: stateProxy,
                        getters: new Proxy(store, {
                            get: (t, p) => {
                                const v = t[p];
                                return v && typeof v.get === 'function' ? v.get() : v;
                            },
                        }),
                        actions: store,
                    };
                    return action.apply(ctx, args);
                };
            }
        }
        store.__dispose__ = () => {
            // FIX (v1.2.3): store را از storeRegistry حذف کن.
            storeRegistry.delete(id);
            computedDisposables.forEach(d => d());
        };
        storeRegistry.set(id, store);
        return store;
    };
}
/**
 * دریافت یک store با ID.
 */
export function getStore(id) {
    return storeRegistry.get(id);
}
/**
 * پاکسازی همه‌ی store ها (برای تست‌ها).
 */
export function clearStores() {
    for (const store of storeRegistry.values()) {
        store.__dispose__?.();
    }
    storeRegistry.clear();
}
//# sourceMappingURL=store.js.map