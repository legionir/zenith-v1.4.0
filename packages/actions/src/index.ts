// packages/actions/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/actions`.
//
// استفاده در سایر پکیج‌ها یا اپلیکیشن:
//   import { registerAction, getAction, action } from '@zenith/actions';
//
// FEATURE (v1.3.0): Instance-based registry via `ActionRegistry` class.
//   import { ActionRegistry } from '@zenith/actions';
//   const registry = new ActionRegistry();
//   registry.register('cart.save', fn, { description: 'Save cart' });
//
// این فایل فقط re-export است تا API پایدار داشته باشیم و بتوانیم
// در آینده بدون شکسته‌سازی importها، ساختار داخلی را تغییر دهیم.

/** @public */
export {
  registerAction,
  unregisterAction,
  getAction,
  getActionMeta,
  hasAction,
  clearActions,
  listActions,
  getDefaultRegistry,
  action,
} from './default-registry';

/** SSR store wiring; canonical home is host integration. @internal */
export { setActionRegistryStore } from './default-registry';

/** @public */
export { ActionRegistry } from './registry';

/** @public */
export type { ActionContext, ActionFn, ActionMetadata, ActionMiddleware } from './types';
