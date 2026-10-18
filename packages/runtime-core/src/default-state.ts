import type { App } from './types';
/** @internal Detach before disposal so a reentrant legacy helper gets a fresh owner. */
export const defaultAppState: { current: App | null } = { current: null };
