import { untrack } from '@zenith/state';
import { isGlobalObservationEnabled } from '@zenith/state/internal';

/** Private host/environment policy, not a public configuration or payload decoder. @internal */
export function isGlobalDiagnosticsAllowed(): boolean {
  return untrack(() => {
    if (!isGlobalObservationEnabled()) return false;
    if (Reflect.get(globalThis, '__ZENITH_SSR__') === true) return false;
    const document: unknown = Reflect.get(globalThis, 'document');
    return !document || (typeof document !== 'object' && typeof document !== 'function') || Reflect.get(document, '__zenithSSR__') !== true;
  });
}
