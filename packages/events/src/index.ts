// packages/events/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/events`.
//
// استفاده:
//   import { initEventDelegation, parseBinding, registerEventModifier } from '@zenith/events';

export {
  parseBinding,
  checkKeyboardModifiers,
  applyBehaviorModifiers,
  registerEventModifier,
  unregisterEventModifier,
  clearEventModifiers,
  hasEventModifier,
  getEventModifier,
  extractListenerOptions,
  BUILTIN_MODIFIERS,
  DELEGATED_EVENTS,
  type ParsedEventBinding,
  type DelegatedEventName,
  type EventModifierHandler,
} from './modifiers';

export {
  initEventDelegation,
  clearBindingCache,
  setLinkNavigationHandler,
  getLinkNavigationHandler,
  type LinkNavigationHandler,
  type DelegationRoot,
  type InitEventDelegationOptions,
} from './delegation';

/**
 * FEATURE (v1.2.0): Timing Modifiers — restored in v1.2.2.
 */
export { applyTimingModifiers, type TimedHandler } from './timing-modifiers';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/events` (`InitEventDelegationOptions`).
 * @default { debounceMs: 250, throttleMs: 250 }
 * @unit ms
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  debounceMs: 250,
  throttleMs: 250,
});

