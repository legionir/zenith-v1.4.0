// packages/events/src/modifiers.ts
//
// تجزیه و اعمال Modifier های رویداد.
//
// FEATURE (v1.3.0): Event Modifier Registry.
//   Plugin ها می‌توانند با `registerEventModifier(name, handler)` modifierهای
//   سفارشی (مثل `.longpress`, `.swipe`, `.doubletap`) اضافه کنند.
/**
 * خروجی تجزیه‌ی یک Attribute Name.
 */
export function parseBinding(rawBinding) {
    const parts = rawBinding.split('.');
    const eventName = parts[0] ?? '';
    const modifiers = parts.slice(1).filter((m) => m.length > 0);
    return { eventName, modifiers };
}
/**
 * بررسی اینکه آیا رویداد کیبورد، شرط‌های modifier های کلیدی را برآورده می‌کند.
 */
export function checkKeyboardModifiers(event, modifiers) {
    if (modifiers.includes('shift') && !event.shiftKey)
        return false;
    if (modifiers.includes('ctrl') && !event.ctrlKey)
        return false;
    if (modifiers.includes('alt') && !event.altKey)
        return false;
    if (modifiers.includes('meta') && !event.metaKey)
        return false;
    const keyMap = {
        enter: ['Enter'],
        escape: ['Escape', 'Esc'],
        tab: ['Tab'],
        space: [' ', 'Space', 'Spacebar'],
        backspace: ['Backspace'],
        del: ['Delete', 'Del'],
        up: ['ArrowUp', 'Up'],
        down: ['ArrowDown', 'Down'],
        left: ['ArrowLeft', 'Left'],
        right: ['ArrowRight', 'Right'],
    };
    const keyModifiers = modifiers.filter((m) => m in keyMap);
    if (keyModifiers.length > 0) {
        const allowed = keyModifiers.some((m) => keyMap[m].includes(event.key));
        if (!allowed)
            return false;
    }
    return true;
}
/**
 * FEATURE (v1.3.0): Registry از Event Modifier های سفارشی.
 */
const _customModifiers = new Map();
/**
 * FEATURE (v1.3.0): مجموعه‌ی نام modifier های built-in.
 */
export const BUILTIN_MODIFIERS = new Set([
    'prevent',
    'stop',
    'immediate',
    'self',
    'once',
    'debounce',
    'throttle',
    'enter',
    'escape',
    'tab',
    'space',
    'backspace',
    'del',
    'up',
    'down',
    'left',
    'right',
    'shift',
    'ctrl',
    'alt',
    'meta',
]);
/**
 * FEATURE (v1.3.0): ثبت یک Event Modifier سفارشی.
 *
 * مثال:
 *   registerEventModifier('longpress', (event, modifiers, element) => {
 *     return true;
 *   });
 *   // HTML: <button zen-action:click.longpress="save">
 */
export function registerEventModifier(name, handler) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new Error(`[Zenith] Event modifier name must be a non-empty string. Received: ${String(name)}`);
    }
    if (!/^[a-zA-Z][a-zA-Z0-9\-]*$/.test(name)) {
        throw new Error(`[Zenith] Invalid event modifier name "${name}". Names must start with a letter ` +
            `and may contain letters, digits, and hyphens.`);
    }
    if (BUILTIN_MODIFIERS.has(name)) {
        throw new Error(`[Zenith] Cannot register built-in modifier "${name}". Built-in modifiers are reserved.`);
    }
    if (typeof handler !== 'function') {
        throw new Error(`[Zenith] Event modifier handler must be a function. Received: ${typeof handler}`);
    }
    _customModifiers.set(name, handler);
}
export function unregisterEventModifier(name) {
    return _customModifiers.delete(name);
}
export function clearEventModifiers() {
    _customModifiers.clear();
}
export function hasEventModifier(name) {
    return _customModifiers.has(name);
}
export function getEventModifier(name) {
    return _customModifiers.get(name);
}
/**
 * اعمال modifier های رفتاری روی رویداد.
 *
 * FEATURE (v1.3.0): اگر هر custom modifier (ثبت‌شده با `registerEventModifier`)
 * `false` برگرداند، `applyBehaviorModifiers` هم `false` برمی‌گرداند.
 *
 * @returns `true` اگر رویداد مجاز به ادامه است، `false` اگر باید متوقف شود.
 */
export function applyBehaviorModifiers(event, modifiers, element) {
    // ── ۱. `.self` — فقط اگر event.target خود element باشد ──
    if (modifiers.includes('self') && element) {
        if (event.target !== element) {
            return false;
        }
    }
    // ── ۲. modifier های رفتاری اصلی ──
    if (modifiers.includes('prevent'))
        event.preventDefault();
    if (modifiers.includes('stop'))
        event.stopPropagation();
    if (modifiers.includes('immediate'))
        event.stopImmediatePropagation();
    // ── ۳. FEATURE (v1.3.0): custom modifier ها ──
    if (_customModifiers.size > 0) {
        for (const modName of modifiers) {
            if (BUILTIN_MODIFIERS.has(modName))
                continue;
            if (/^\d+$/.test(modName))
                continue;
            const handler = _customModifiers.get(modName);
            if (handler) {
                try {
                    const result = handler(event, modifiers, element ?? event.currentTarget);
                    if (result === false)
                        return false;
                }
                catch (err) {
                    console.error(`[Zenith] Custom event modifier "${modName}" threw:`, err);
                }
            }
        }
    }
    return true;
}
/**
 * لیست رویدادهایی که در Event Delegation پشتیبانی می‌شوند.
 *
 * BUG FIX (v7.0): `focusin` و `focusout` اضافه شدند.
 */
export const DELEGATED_EVENTS = [
    'click',
    'input',
    'change',
    'submit',
    'keydown',
    'keyup',
    'focusin',
    'focusout',
];
//# sourceMappingURL=modifiers.js.map
