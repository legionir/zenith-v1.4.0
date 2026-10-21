import { registerCache } from '@zenith/devtools-core';

class SessionCache {
  private store = new Map<string, number>();
}

export function setup(cache: never): void {
  registerCache('session', cache);
}
