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
  type ResourceState,
  type ResourceConfig,
  type CrudResult,
  type CrudOperation,
} from './resource';

export { processResource } from './directive';
