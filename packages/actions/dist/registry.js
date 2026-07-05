// packages/actions/src/registry.ts
//
// Action Registry — ثبت و بازیابی توابع Business Logic.
//
// ایده‌ی اصلی:
//   به‌جای اینکه در HTML به صورت inline کد بنویسیم (مثل onclick="alert(...)")،
//   فقط یک «نام اکشن» می‌نویسیم (مثل zen-action="save") و خود تابع در JS
//   با Zen.action('save', fn) ثبت می‌شود.
//
// مزایا:
//   1) جدایی کامل لایه‌ی UI (HTML) از منطق (JS).
//   2) امنیت: هیچ کدی از HTML اجرا نمی‌شود، فقط نام‌های از پیش ثبت‌شده.
//   3) قابلیت تست: توابع اکشن مستقل از DOM قابل تست هستند.
//   4) Tree-shaking: توابعی که استفاده نمی‌شوند به build نهایی نمی‌روند.
//
// FEATURE (v1.3.0):
//   - Instance-based registry via `ActionRegistry` class (multi-app friendly).
//   - Optional metadata (description, category, permissions, ...) for DevTools.
//   - Namespace support: names may contain `.` (e.g. `cart.save`, `admin.delete`).
//   - `listActions()` / `getActionMeta()` for introspection.
//   The module-level singleton API (`registerAction`, `getAction`, ...) is
//   preserved for backward compatibility and delegates to a default
//   `ActionRegistry` instance.
/**
 * FEATURE (v1.3.0): کلاس ActionRegistry — نمونه‌پذیر برای Multi-App.
 *
 * مثال:
 *   const registry = new ActionRegistry();
 *   registry.register('cart.save', (ctx) => { ... }, { description: '...' });
 *   Zen.start({ state, registry });
 */
export class ActionRegistry {
    _actions = new Map();
    /**
     * ثبت (یا بازنویسی) یک Action.
     */
    register(name, fn, metadata) {
        this._validateName(name);
        this._validateFn(fn);
        this._actions.set(name, { fn, metadata });
        return this;
    }
    unregister(name) {
        return this._actions.delete(name);
    }
    get(name) {
        return this._actions.get(name)?.fn;
    }
    getMeta(name) {
        return this._actions.get(name)?.metadata;
    }
    has(name) {
        return this._actions.has(name);
    }
    clear() {
        this._actions.clear();
    }
    list() {
        const result = [];
        for (const [name, entry] of this._actions) {
            result.push({ name, metadata: entry.metadata });
        }
        return result;
    }
    get size() {
        return this._actions.size;
    }
    _validateName(name) {
        if (typeof name !== 'string' || name.length === 0) {
            throw new Error(`[Zenith] Action name must be a non-empty string. Received: ${String(name)}`);
        }
        // FEATURE (v1.3.0): Allow `.` for namespacing (e.g. `cart.save`).
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$.\-]*$/.test(name)) {
            throw new Error(`[Zenith] Invalid action name "${name}". Names must start with a letter, ` +
                `underscore, or $, and may contain letters, digits, underscores, $, ` +
                `dots (for namespaces), and hyphens.`);
        }
        if (name.startsWith('.') || name.endsWith('.') || name.includes('..')) {
            throw new Error(`[Zenith] Invalid action name "${name}". Dots cannot be leading, trailing, or doubled.`);
        }
    }
    _validateFn(fn) {
        if (typeof fn !== 'function') {
            throw new Error(`[Zenith] Action handler must be a function. Received: ${typeof fn}`);
        }
    }
}
// ── Singleton پیش‌فرض — Backward Compatibility ──
const _defaultRegistry = new ActionRegistry();
export function registerAction(name, fn, metadata) {
    _defaultRegistry.register(name, fn, metadata);
}
export function unregisterAction(name) {
    return _defaultRegistry.unregister(name);
}
export function getAction(name) {
    return _defaultRegistry.get(name);
}
export function getActionMeta(name) {
    return _defaultRegistry.getMeta(name);
}
export function hasAction(name) {
    return _defaultRegistry.has(name);
}
export function clearActions() {
    _defaultRegistry.clear();
}
export function listActions() {
    return _defaultRegistry.list();
}
export function getDefaultRegistry() {
    return _defaultRegistry;
}
export const action = {
    register: registerAction,
    unregister: unregisterAction,
    has: hasAction,
    clear: clearActions,
    list: listActions,
    getMeta: getActionMeta,
};
//# sourceMappingURL=registry.js.map
