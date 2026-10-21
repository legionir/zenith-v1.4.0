import { registerDevtoolsCache } from '@zenith/devtools-core';

class SessionCache {
  private store = new Map<string, number>();
}

export function setup(cache: never): void {
  registerDevtoolsCache('session', cache);
}
