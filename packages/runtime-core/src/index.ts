/** Instance-owned DOM runtime, lifecycle, registries and hydration. @packageDocumentation */
export type { App, AppOptions, AppSsrOptions, BindContext, DirectiveDefinition, HydrationMismatch, HydrationResult, Plugin, PluginEntry, ResolvedAppOptions, SsrContext } from './types';
export { createApp } from './app';
export { appOptions, appOptionsSchema, APP_OPTIONS_DEFAULTS, resolveAppOptions } from './options';
export { defaultApp, resetDefaultAppForTesting } from './default-app';
export { hydrate, startFromSSR } from './hydrate';
export { onMount, onUnmount, onUpdate, provide, inject, useApp, createInjectionKey, defineDirective, definePlugin, assertCompatible, ZENITH_RUNTIME_CORE_VERSION, type InjectionKey } from './scope';
export { createRegistry, type Registry, type AppRegistries } from './registry';
export { useId } from './identity';
export { createFocusTrap, createRovingTabindex, lockScroll, type FocusTrap, type FocusTrapOptions } from '@zenith/a11y';
export { computePosition, type ComputePositionOptions } from '@zenith/ui/position';
