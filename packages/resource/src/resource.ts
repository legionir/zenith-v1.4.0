// Established facade: one constructor and one registration store.
export { Resource } from './engine';
export type { ResourceState, ResourceConfig, CrudResult, CrudOperation } from './types';
export { createResource, getResource, registerResource, hasResource, listResources, unregisterResource, resetResourceRegistry, clearResources, clearResourcesInternal, invalidateAllResources, invalidate } from './registry';
