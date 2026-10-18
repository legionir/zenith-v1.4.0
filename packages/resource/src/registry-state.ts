import { createScopedRegistry } from '@zenith/shared';
import type { Resource } from './engine';
/** Shared registry storage; no runtime engine dependency. @internal */
export const resourceRegistry = createScopedRegistry<Resource<unknown>>('resources');
/** Identity-indexed registration tokens used during owner disposal. @internal */
export const resourceRegistrations = new WeakMap<object, Set<() => void>>();
