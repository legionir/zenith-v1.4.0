/** @public */
export {
  defineStore,
  registerStore,
  getStore,
  hasStore,
  listStores,
  unregisterStore,
  clearStores,
  persistStore,
  useStorePlugin,
  type Store,
  type StoreDefinition,
  type StoreContext,
  type StorePersistOptions,
  type StorePersistStorage,
  type StoreActionContext,
  type StorePlugin,
} from './store';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/store` (`StorePersistOptions`).
 * @default { version: 1, debounceMs: 200, encrypt: false }
 * @since 1.4.0
 * @public
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  version: 1,
  debounceMs: 200,
  encrypt: false,
});
