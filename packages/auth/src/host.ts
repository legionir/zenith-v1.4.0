export function assertAuthEndpoint(url: string): void {
    const base = typeof location !== 'undefined' ? location.href : 'http://localhost/';
    const endpoint = new URL(url, base);
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password ||
      (typeof location !== 'undefined' && endpoint.origin !== location.origin)) {
      throw new Error('Authentication endpoint must be same-origin HTTP(S)');
    }
  }

export function sendLogoutBeacon(url: string): boolean {
    try {
      return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(url, new Blob([''], { type: 'application/json' }));
    } catch { return false; }
  }

