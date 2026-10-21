/** Scoped stores, typed computed getters, actions and persistence. @packageDocumentation */
export { defineStore } from './engine';
export { getStore, registerStore, hasStore, listStores, unregisterStore, clearStores, clearStoresInternal, useStorePlugin } from './registry';
export { persistStore } from './persist';
export type { Store, StoreDefinition, StoreContext, StorePersistOptions, StorePersistStorage, StoreActionContext, StorePlugin } from './types';
