// packages/events/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/events`.
//
// استفاده:
//   import { initEventDelegation, parseBinding, registerEventModifier } from '@zenith/events';
export { parseBinding, checkKeyboardModifiers, applyBehaviorModifiers, registerEventModifier, unregisterEventModifier, clearEventModifiers, hasEventModifier, getEventModifier, BUILTIN_MODIFIERS, DELEGATED_EVENTS, } from './modifiers.js';
export { initEventDelegation, clearBindingCache, } from './delegation.js';
/**
 * FEATURE (v1.2.0): Timing Modifiers — restored in v1.2.2.
 */
export { applyTimingModifiers } from './timing-modifiers.js';
//# sourceMappingURL=index.js.map
