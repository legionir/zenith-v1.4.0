// packages/events/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/events`.
//
// استفاده:
//   import { initEventDelegation, parseBinding, registerEventModifier } from '@zenith/events';

/** @public */
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
  PASSIVE_BY_DEFAULT_EVENTS,
  NON_BUBBLING_EVENTS,
  resetPassiveWarnings,
  type ParsedEventBinding,
  type DelegatedEventName,
  type EventModifierHandler,
} from './modifiers';

/** @public */
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
 * @public
 */
export { applyTimingModifiers, type TimedHandler } from './timing-modifiers';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/events` (`InitEventDelegationOptions`).
 * @default { debounceMs: 250, throttleMs: 250 }
 * @unit ms
 * @since 1.4.0
 * @public
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  debounceMs: 250,
  throttleMs: 250,
});
