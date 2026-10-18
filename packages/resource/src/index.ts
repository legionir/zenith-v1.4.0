export {
  Resource,
  createResource,
  registerResource,
  getResource,
  hasResource,
  listResources,
  unregisterResource,
  clearResources,
  resetResourceRegistry,
  invalidateAllResources,
  invalidate,
  type ResourceState,
  type ResourceConfig,
  type CrudResult,
  type CrudOperation,
} from './resource';

export { processResource, type ResourceBindContext } from './directive';
