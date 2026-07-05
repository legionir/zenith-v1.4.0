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
  BUILTIN_MODIFIERS,
  DELEGATED_EVENTS,
  type ParsedEventBinding,
  type DelegatedEventName,
  type EventModifierHandler,
} from './modifiers';

export {
  initEventDelegation,
  clearBindingCache,
  type DelegationRoot,
  type InitEventDelegationOptions,
} from './delegation';

/**
 * FEATURE (v1.2.0): Timing Modifiers — restored in v1.2.2.
 */
export { applyTimingModifiers, type TimedHandler } from './timing-modifiers';
