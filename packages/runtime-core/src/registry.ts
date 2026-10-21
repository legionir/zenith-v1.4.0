import { createReferenceRegistry, type ReferenceRegistry, type RegistryOwner } from '@zenith/shared';
import { logger } from '@zenith/logger';
import type { App, DirectiveDefinition, Plugin } from './types';

/** @public */
export type Registry<T> = ReferenceRegistry<T>;
/** @public */
export function createRegistry<T>(): Registry<T> {
  return createReferenceRegistry<T>({ onObserverError: () => logger.warn('[Zenith] Registry observer failed.') });
}

/**
 * App inventory for #118. Unknown values at extension boundaries require
 * narrowing instead of exposing `any`. Lower-layer legacy adapters are migrated
 * separately; these stores never fall back to another App or a global registry.
 * @public
 */
export interface AppRegistries {
  actions: Registry<Parameters<App['action']>[1]>;
  components: Registry<HTMLTemplateElement>;
  auth: Registry<unknown>;
  permissions: Registry<unknown>;
  resources: Registry<unknown>;
  stores: Registry<unknown>;
  serverComponents: Registry<unknown>;
  directives: Registry<DirectiveDefinition>;
  plugins: Registry<Plugin<unknown>>;
  devtools: Registry<unknown>;
}

/** @internal */
export function createAppRegistries(): AppRegistries & RegistryOwner['registries'] {
  return {
    actions: createRegistry<Parameters<App['action']>[1]>(), components: createRegistry<HTMLTemplateElement>(), auth: createRegistry<unknown>(),
    permissions: createRegistry(), resources: createRegistry(), stores: createRegistry(),
    serverComponents: createRegistry(), directives: createRegistry<DirectiveDefinition>(), plugins: createRegistry<Plugin<unknown>>(),
    devtools: createRegistry(),
  };
}
