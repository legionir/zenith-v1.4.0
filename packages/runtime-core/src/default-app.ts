import { onGlobalReset } from '@zenith/errors';
import type { App } from './types';
import { createApp } from './app';
import { defaultAppState } from './default-state';

/** @public */
export function defaultApp(): App {
  if (!defaultAppState.current) {
    defaultAppState.current = createApp();
  }
  return defaultAppState.current;
}

/** @public */
export function resetDefaultAppForTesting(): void {
  const previous = defaultAppState.current;
  defaultAppState.current = null;
  previous?.dispose();
}

// Keep the published bundle's default App reachable by resetForTesting too.
onGlobalReset(resetDefaultAppForTesting);

